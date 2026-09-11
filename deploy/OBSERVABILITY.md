# Install Prometheus + Grafana on Ubuntu 22.04

## Prometheus

```bash
sudo apt-get install -y prometheus
# or download binary if the apt version is old
```

## Grafana

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo wget -q -O /usr/share/keyrings/grafana.key https://packages.grafana.com/gpg.key
sudo apt-get update && sudo apt-get install -y grafana
sudo systemctl enable --now grafana-server
```

## Access

- Prometheus: `http://VM_IP:9090`
- Grafana: `http://VM_IP:3001`
  - Default port 3000 conflicts with Next.js dev server. Set in `/etc/grafana/grafana.ini`:
    ```ini
    [server]
    http_port = 3001
    ```
- Default Grafana login: `admin` / `admin`

## Provisioning

Run `deploy/deploy.sh` — it copies `deploy/prometheus.yml` and `deploy/grafana-datasource.yml`
into their respective config directories and restarts the services automatically, but only if
the binaries are installed. The brain has zero runtime dependency on either service.
