FROM python:3.13.5-alpine3.22

WORKDIR /app

COPY docker/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt


CMD [ "python", "./app.py" ]