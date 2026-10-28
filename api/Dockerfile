FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json yarn.lock .yarnrc .npmrc ./
RUN corepack enable && yarn install --frozen-lockfile --non-interactive
COPY public ./public
COPY src ./src
COPY index.html vite.config.mjs ./
RUN REACT_APP_ACCOUNT_BACKEND=django yarn build

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.settings.production
WORKDIR /app/api
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --uid 10001 billflow
COPY api .
COPY --from=web /app/build /app/build
RUN mkdir -p .local && chown -R billflow:billflow /app
USER billflow
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--error-logfile", "-", "--capture-output"]
