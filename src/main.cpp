// Copyright (C) 2026 piotrek-d1 <piotrek-d1@o2.pl>
// SPDX-License-Identifier: GPL-3.0-or-later

#include <QApplication>
#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QProcess>
#include <QSaveFile>
#include <QStandardPaths>
#include <QTextStream>
#include <QTimer>
#include <QUrl>
#include <QVBoxLayout>
#include <QWidget>
#include <QRegularExpression>
#include <QUuid>
#include <QElapsedTimer>
#include <QEventLoop>
#include <QFont>
#include <QPointer>

static QString dataDirectory() {
    QString base = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation);
    QDir().mkpath(base + "/logs");
    return base;
}
static QString safeId(const QString &v) {
    if (QRegularExpression("^[a-zA-Z0-9_-]{1,80}$").match(v).hasMatch()) return v;
    return QString();
}
static void writeLog(const QString &id, const QString &mode, const QString &target, bool ok, const QString &detail) {
    QString fileName = dataDirectory() + "/logs/" + id + ".log";
    QFile file(fileName);
    if (file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text)) {
        QTextStream stream(&file);
        QString cleanDetail = detail;
        cleanDetail.replace('\n', ' ').replace('\r', ' ');
        stream << QDateTime::currentDateTime().toString(Qt::ISODateWithMs) << '\t'
               << mode << '\t' << (ok ? "OK" : "FAIL") << '\t'
               << QString(target).replace('\n', ' ') << '\t' << cleanDetail << '\n';
    }
}
static int check(const QStringList &args) {
    QJsonObject result;
    const QString id = args.value(2);
    const QString mode = args.value(3).toLower();
    const QString target = args.value(4).trimmed();
    bool intervalOk = false;
    int timeout = args.value(5, "5000").toInt(&intervalOk);
    if (!intervalOk || timeout < 500 || timeout > 30000) timeout = 5000;
    bool ok = false;
    QString detail;
    if (safeId(id).isEmpty() || target.isEmpty() || (mode != "http" && mode != "ping")) {
        detail = "Invalid arguments";
    } else if (mode == "http") {
        QString address = target;
        if (!address.contains("://")) address.prepend("http://");
        QUrl url(address);
        if (!url.isValid() || (url.scheme() != "http" && url.scheme() != "https") || url.host().isEmpty()) {
            detail = "Invalid HTTP URL";
        } else {
            QNetworkAccessManager manager;
            QNetworkRequest req(url);
            req.setTransferTimeout(timeout);
            req.setRawHeader("User-Agent", "MintServiceTiles/0.2");
            req.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::ManualRedirectPolicy);
            QNetworkReply *reply = manager.get(req);
            // Only status headers matter. Abort body download once metadata is available.
            QTimer timer;
            timer.setSingleShot(true);
            QEventLoop loop;
            QObject::connect(&timer, &QTimer::timeout, &loop, [&]() { reply->abort(); loop.quit(); });
            QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
            timer.start(timeout + 500);
            loop.exec();
            int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
            ok = (reply->error() == QNetworkReply::NoError && status == 200);
            detail = status ? "HTTP " + QString::number(status) : reply->errorString();
            reply->deleteLater();
        }
    } else {
        // Never execute through a shell, and disallow command-line-looking hosts.
        QString host = target;
        QUrl parsed(target);
        if (target.contains("://")) host = parsed.host();
        if (host.isEmpty() || host.startsWith('-') || host.contains(QRegularExpression("[\\s/]"))) {
            detail = "Invalid ping host";
        } else {
            QProcess proc;
            proc.start("/usr/bin/ping", {"-n", "-c", "1", "-W", QString::number(qMax(1, (timeout + 999) / 1000)), "--", host});
            if (!proc.waitForStarted(1500)) detail = "Cannot start /usr/bin/ping";
            else if (!proc.waitForFinished(timeout + 1500)) { proc.kill(); proc.waitForFinished(); detail = "Timeout"; }
            else {
                ok = proc.exitStatus() == QProcess::NormalExit && proc.exitCode() == 0;
                detail = ok ? "ICMP reply" : "No ICMP reply";
            }
        }
    }
    result["ok"] = ok;
    result["detail"] = detail;
    result["mode"] = mode;
    result["target"] = target;
    result["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODateWithMs);
    if (!safeId(id).isEmpty()) writeLog(id, mode, target, ok, detail);
    QTextStream(stdout) << QJsonDocument(result).toJson(QJsonDocument::Compact) << '\n';
    return ok ? 0 : 1;
}
static int alarm(int argc, char **argv) {
    QApplication app(argc, argv);
    app.setQuitOnLastWindowClosed(true);
    QWidget window;
    window.setWindowTitle("Mint Service Tiles - ALARM");
    window.setWindowFlags(Qt::Tool | Qt::WindowStaysOnTopHint | Qt::WindowCloseButtonHint);
    window.setStyleSheet("QWidget { background: #8e2222; color: white; } QLabel { padding: 12px; font-weight: bold; font-size: 16px; }");
    auto *layout = new QVBoxLayout(&window);
    auto *label = new QLabel(QString::fromUtf8("⚠ Service Tiles: usługa niedostępna / Service unavailable"));
    label->setWordWrap(true);
    layout->addWidget(label);
    window.resize(420, 100);
    window.show();
    return app.exec();
}
int main(int argc, char **argv) {
    QStringList args;
    for (int i = 0; i < argc; ++i) args << QString::fromLocal8Bit(argv[i]);
    if (args.value(1) == "--alarm") return alarm(argc, argv);
    QCoreApplication app(argc, argv);
    if (args.value(1) == "--check" && args.size() >= 5) return check(args);
    QTextStream(stderr) << "Usage: mint-service-check --check ID http|ping TARGET [TIMEOUT_MS] | --alarm\n";
    return 2;
}
