FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN apt-get update && apt-get install -y \
    nmap \
    curl \
    git \
    ruby \  
    ruby-dev \
    build-essential \
    wget \
    golang \
    && rm -rf /var/lib/apt/lists/*

RUN go install github.com/OJ/gobuster/v3@latest && \
    mv /root/go/bin/gobuster /usr/local/bin/

# Nuclei (template-based scanner) — finds CVEs/exposures on modern sites.
RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    mv /root/go/bin/nuclei /usr/local/bin/
RUN nuclei -update-templates || true

# Code-scan tools (run on repo source, no deploy needed) are all pip-installed
# via requirements.txt: semgrep (SAST), detect-secrets (secrets), pip-audit (deps).

RUN git clone https://github.com/sullo/nikto.git /opt/nikto && \
    ln -s /opt/nikto/program/nikto.pl /usr/local/bin/nikto && \
    chmod +x /usr/local/bin/nikto

RUN git clone --depth 1 https://github.com/sqlmapproject/sqlmap.git /opt/sqlmap && \
    ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap && \
    chmod +x /usr/local/bin/sqlmap


RUN gem install wpscan

COPY . .

RUN mkdir -p /usr/share/wordlists/dirb

RUN if [ ! -f /usr/share/wordlists/dirb/common.txt ]; then \
    wget -q https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt -O /usr/share/wordlists/dirb/common.txt; \
    fi

# Make entrypoint executable
RUN chmod +x entrypoint.sh

CMD ["./entrypoint.sh"]
