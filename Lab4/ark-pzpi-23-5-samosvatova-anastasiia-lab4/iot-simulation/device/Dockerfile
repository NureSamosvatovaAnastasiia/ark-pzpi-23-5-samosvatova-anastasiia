FROM python:3.9-slim


WORKDIR /app


RUN pip install --no-cache-dir paho-mqtt

COPY device.py .

CMD ["python", "-u", "device.py"]