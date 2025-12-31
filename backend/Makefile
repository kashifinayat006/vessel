.PHONY: build run clean test deps

# Build the server binary
build:
	go build -o bin/server ./cmd/server

# Run the server
run:
	go run ./cmd/server

# Run with custom options
run-dev:
	go run ./cmd/server -port 8080 -db ./data/dev.db

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf data/

# Run tests
test:
	go test -v ./...

# Download dependencies
deps:
	go mod download
	go mod tidy

# Build for multiple platforms
build-all:
	GOOS=linux GOARCH=amd64 go build -o bin/server-linux-amd64 ./cmd/server
	GOOS=darwin GOARCH=amd64 go build -o bin/server-darwin-amd64 ./cmd/server
	GOOS=darwin GOARCH=arm64 go build -o bin/server-darwin-arm64 ./cmd/server
	GOOS=windows GOARCH=amd64 go build -o bin/server-windows-amd64.exe ./cmd/server
