FROM rust:1.93-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY assets ./assets
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system app \
  && useradd --system --gid app --create-home --home-dir /app app
WORKDIR /app
COPY --from=builder /app/target/release/intelligence-fn-rs /usr/local/bin/intelligence-fn-rs
COPY --from=builder /app/assets ./assets
RUN chown -R app:app /app /usr/local/bin/intelligence-fn-rs
USER app

ENV RUST_LOG=info
ENV INTELLIGENCE_FN_ADDR=0.0.0.0:8080
EXPOSE 8080
CMD ["/usr/local/bin/intelligence-fn-rs"]
