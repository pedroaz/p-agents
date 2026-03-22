.PHONY: run install kill

run: kill
	@echo "Starting both servers..."
	@make -C ui run &
	@make -C server run &
	@echo "UI running on http://localhost:5555"
	@echo "Server running on http://localhost:5556"

kill:
	@echo "Stopping all servers..."
	@pkill -f "next" || true
	@pkill -f "flask" || true
	@pkill -f "python.*app.py" || true
	@echo "All servers stopped"