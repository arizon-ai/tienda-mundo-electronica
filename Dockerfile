FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy site files
COPY . /usr/share/nginx/html

# Remove files that shouldn't be served
RUN rm -f /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/nginx.conf \
    /usr/share/nginx/html/.gitignore \
    /usr/share/nginx/html/.gitattributes && \
    rm -rf /usr/share/nginx/html/.git \
    /usr/share/nginx/html/assets/Docs\ Legales*

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
