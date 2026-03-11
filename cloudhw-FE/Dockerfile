FROM node:22-alpine as build
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

RUN npm run build

FROM nginx:1.27-alpine as ngx
# Copy nginx config as a template; BACKEND_URL will be substituted at startup
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY --from=build /usr/src/app/dist/cloudhw-fe/browser /usr/share/nginx/html
COPY --from=build /usr/src/app/src/assets/env.template.js /usr/share/nginx/html/assets/env.template.js

EXPOSE 8080
# At startup:
#  1. Substitute only ${BACKEND_URL} in the nginx config template (leaves nginx's own $variables intact)
#  2. Write env.js for the Angular app (always uses '/' — nginx handles the proxy)
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/env.js && exec nginx -g 'daemon off;'"]
