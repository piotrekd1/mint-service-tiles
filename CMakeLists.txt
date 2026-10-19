# Copyright (C) 2026 piotrek-d1 <piotrek-d1@o2.pl>
# SPDX-License-Identifier: GPL-3.0-or-later

cmake_minimum_required(VERSION 3.16)
project(mint_service_tiles VERSION 0.2 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(Qt6 REQUIRED COMPONENTS Core Network Widgets)
add_executable(mint-service-check src/main.cpp)
target_link_libraries(mint-service-check PRIVATE Qt6::Core Qt6::Network Qt6::Widgets)
install(TARGETS mint-service-check RUNTIME DESTINATION bin)
