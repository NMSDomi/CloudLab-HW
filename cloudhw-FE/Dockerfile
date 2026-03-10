FROM node:22-alpine as build
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

RUN npm run build

FROM nginx:1.27-alpine as ngx
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/dist/cloudhw-fe/browser /usr/share/nginx/html
COPY --from=build /usr/src/app/src/assets/env.template.js /usr/share/nginx/html/assets/env.template.js

EXPOSE 8080
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/env.js && exec nginx -g 'daemon off;'"]
