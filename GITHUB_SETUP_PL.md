# Jak opublikować Mint Service Tiles na GitHub

## 1. Utwórz repozytorium

1. Zaloguj się na https://github.com/.
2. Kliknij **+** w prawym górnym rogu i wybierz **New repository** (lub otwórz https://github.com/new).
3. Wpisz nazwę: `mint-service-tiles`.
4. W polu **Description** wklej:

   `Cinnamon desklet for Linux Mint that monitors HTTP endpoints and ICMP ping hosts using customizable status tiles.`

5. Wybierz **Public** albo **Private**.
6. Nie zaznaczaj automatycznego tworzenia README ani `.gitignore` — są już w paczce.
7. Kliknij **Create repository**.

## 2A. Prześlij projekt przez stronę GitHub

1. Rozpakuj paczkę z plikami projektu.
2. W pustym repozytorium kliknij **uploading an existing file** lub **Add file → Upload files**.
3. Dodaj pliki **i katalogi z rozpakowanego projektu**, nie przesyłaj samego archiwum ZIP.
4. Sprawdź, czy `README.md`, `src/`, `desklet/`, `install.sh` i `refresh-translations.py` są widoczne.
5. Podaj opis commita, np. `Initial release v0.20`, i zatwierdź (**Commit changes**).

Uwaga: przesyłanie ukrytego pliku `.gitignore` przez przeglądarkę może zależeć od sposobu wyboru plików. Metoda Git z punktu 2B jest bardziej niezawodna.

## 2B. Prześlij projekt z terminala (zalecane)

Zainstaluj Git, jeśli nie jest dostępny:

```bash
sudo apt install git
```

W katalogu **rozpakowanej** paczki wykonaj:

```bash
git init
git branch -M main
git add .
git commit -m "Initial release v0.20"
git remote add origin https://github.com/TWOJ-LOGIN/mint-service-tiles.git
git push -u origin main
```

Usuń spację na początku linii z komendami, jeśli kopiujesz je ręcznie. Zastąp `TWOJ-LOGIN` własną nazwą konta GitHub. Przy pierwszym commicie Git może poprosić o ustawienie nazwy i adresu autora:

```bash
git config --global user.name "piotrek-d1"
git config --global user.email "piotrek-d1@o2.pl"
```

GitHub wymaga logowania — dla HTTPS zwykle przez przeglądarkę/narzędzie uwierzytelniające lub token, **nie hasło konta**. Alternatywą jest SSH.

## 3. Dodaj ustawienia repozytorium

W **About** ustaw opis z punktu 1 oraz tematy (Topics):

`linux-mint`, `cinnamon`, `cinnamon-desklet`, `monitoring`, `http`, `icmp`, `ping`, `qt6`, `cpp`.

Opcjonalnie w zakładce **Releases** utwórz `v0.20` i dołącz ZIP. Warto też dodać prawdziwy zrzut ekranu deskletu do README.

## 4. Licencja

Projekt ma już dołączoną licencję **GPL-3.0-or-later** w pliku `LICENSE`. Nie dodawaj drugiego pliku licencji przez kreator GitHub. Nagłówki SPDX w plikach źródłowych określają tę samą licencję.

Copyright (C) 2026 piotrek-d1 <piotrek-d1@o2.pl>.


## 5. Kolejne aktualizacje

```bash
git add .
git commit -m "Describe your changes"
git push
```

Nie publikuj prywatnych logów ani pliku ustawień ze swoimi adresami i adresami IP.
