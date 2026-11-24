FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --chown=nginx:nginx docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx index.html index.md /usr/share/nginx/html/
COPY --chown=nginx:nginx assets/ /usr/share/nginx/html/assets/
COPY --chown=nginx:nginx css/ /usr/share/nginx/html/css/
COPY --chown=nginx:nginx pages/ /usr/share/nginx/html/pages/

EXPOSE 8080
