FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o keyserver ./cmd/keyserver

FROM alpine:3.19

RUN apk add --no-cache wget

WORKDIR /app
COPY --from=builder /app/keyserver .

EXPOSE 8081
CMD ["./keyserver"]
