.PHONY: run gh-login

run:
	@FLASK_APP=app.py FLASK_DEBUG=1 flask run --reload --port 5556

gh-login:
	unset GITHUB_TOKEN && gh auth login