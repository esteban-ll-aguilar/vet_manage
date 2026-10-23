SHELL := /bin/sh

DOCKER_COMPOSE ?= docker compose
PODMAN_COMPOSE ?= podman compose

.PHONY: up up-podman down down-podman restart restart-podman logs logs-podman ps ps-podman build build-frontend test lint

up:
	$(DOCKER_COMPOSE) up --build -d

up-podman:
	$(PODMAN_COMPOSE) up --build -d

down:
	$(DOCKER_COMPOSE) down

down-podman:
	$(PODMAN_COMPOSE) down

restart:
	$(DOCKER_COMPOSE) restart

restart-podman:
	$(PODMAN_COMPOSE) restart

logs:
	$(DOCKER_COMPOSE) logs -f

logs-podman:
	$(PODMAN_COMPOSE) logs -f

ps:
	$(DOCKER_COMPOSE) ps

ps-podman:
	$(PODMAN_COMPOSE) ps

build:
	cd vet-manage-api && npm run build
	cd vet-manage-frontend && npm run build

build-frontend:
	cd vet-manage-frontend && npm run build

test:
	cd vet-manage-api && npm test -- --run

lint:
	cd vet-manage-api && npm run lint
	cd vet-manage-frontend && npm run lint
