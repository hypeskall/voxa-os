FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends clamav clamav-daemon ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/clamav /tmp/clamav /var/lib/clamav \
    && chown -R clamav:clamav /run/clamav /tmp/clamav /var/lib/clamav
COPY clamd.conf /etc/clamav/clamd.conf
COPY server.mjs start.sh /app/
RUN chmod 755 /app/start.sh
EXPOSE 8080
ENTRYPOINT ["/app/start.sh"]
