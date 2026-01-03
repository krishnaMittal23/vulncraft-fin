const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class EphemeralDeployer {
  constructor() {
    this.activeContainers = new Map();
  }

  getTempDir() {
    return os.tmpdir();
  }

  getRemoveCommand(dirPath) {
    if (os.platform() === 'win32') {
      return `rmdir /S /Q "${dirPath}"`;
    } else {
      return `rm -rf "${dirPath}"`;
    }
  }

  /**
   * Get the network-accessible URL for the deployed container
   * Replaces localhost with the actual network IP or a resolvable hostname
   * so that Django backend running in Docker can access it
   */
  getNetworkAccessibleUrl(localhostUrl) {
    // Extract port from localhost URL
    const portMatch = localhostUrl.match(/localhost:(\d+)/);
    if (!portMatch) return localhostUrl;
    
    const port = portMatch[1];
    
    // Get the actual network IP address
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = null;
    
    // Find the first non-internal IPv4 address
    for (const interfaceName in networkInterfaces) {
      const addresses = networkInterfaces[interfaceName];
      for (const addr of addresses) {
        // Skip internal (loopback) addresses and IPv6
        if (addr.family === 'IPv4' && !addr.internal) {
          ipAddress = addr.address;
          break;
        }
      }
      if (ipAddress) break;
    }
    
    // If we found an IP, use it; otherwise fall back to host.docker.internal
    if (ipAddress) {
      console.log(`🌐 Using network IP: ${ipAddress} (accessible from Docker containers)`);
      return `http://${ipAddress}:${port}`;
    }
    
    // Fallback to host.docker.internal (works on Docker Desktop)
    console.log(`⚠️ Could not detect network IP, using host.docker.internal`);
    return `http://host.docker.internal:${port}`;
  }

  async deployFromGithub(repoUrl, workflowId) {

    if (this.activeContainers.has(workflowId)) {
      const obj = this.activeContainers.get(workflowId);
      obj.refCount = (obj.refCount || 1) + 1;
      return obj.deployedUrl;
    }
    const tempDir = this.getTempDir();
    const repoPath = path.join(tempDir, `vulncraft_${workflowId}`);
    try {
      await fs.access(repoPath);
      await execPromise(this.getRemoveCommand(repoPath));
    } catch {}
    await execPromise(`git clone "${repoUrl}" "${repoPath}"`);
    const hasDockerCompose = await this.checkFileExists(path.join(repoPath, 'docker-compose.yml'));
    const hasDockerfile = await this.checkFileExists(path.join(repoPath, 'Dockerfile'));
    let deployedUrl;
    if (hasDockerCompose) {
      deployedUrl = await this.deployWithCompose(repoPath, workflowId);
    } else if (hasDockerfile) {
      deployedUrl = await this.deployWithDockerfile(repoPath, workflowId);
    } else {
      throw new Error('No Dockerfile or docker-compose.yml found in repository');
    }
    const info = this.activeContainers.get(workflowId) || {};
    info.deployedUrl = deployedUrl;
    info.refCount = 1;
    this.activeContainers.set(workflowId, info);
    return deployedUrl;
  }

  async checkFileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deployWithDockerfile(repoPath, workflowId) {
    const hostPort = Math.floor(Math.random() * 1000) + 8000;
    const containerName = `vulncraft_temp_${workflowId}`;
    const imageName = `vulncraft_image_${workflowId}`;
    await execPromise(`docker build -t "${imageName}" "${repoPath}"`);
    const dockerfile = await fs.readFile(path.join(repoPath, 'Dockerfile'), 'utf-8');
    const exposeMatch = dockerfile.match(/EXPOSE\s+(\d+)/i);
    const containerPort = exposeMatch ? parseInt(exposeMatch[1]) : 80;
    await execPromise(`docker run -d --name "${containerName}" -p ${hostPort}:${containerPort} "${imageName}"`);
    this.activeContainers.set(workflowId, {
      containerId: containerName,
      imageId: imageName,
      port: hostPort,
      repoPath,
      refCount: 1,
      deployedUrl: `http://localhost:${hostPort}`,
    });
    await new Promise(r => setTimeout(r, 8000));
    return `http://localhost:${hostPort}`;
  }

  async deployWithCompose(repoPath, workflowId) {
    await execPromise(`docker-compose up -d`, { cwd: path.resolve(repoPath) });
    const composeFile = await fs.readFile(path.join(repoPath, 'docker-compose.yml'), 'utf-8');
    const portMatch = composeFile.match(/['"]?(\d+):\d+['"]?/);
    const exposedPort = portMatch ? parseInt(portMatch[1]) : 8080;
    this.activeContainers.set(workflowId, {
      composePath: repoPath,
      port: exposedPort,
      refCount: 1,
      deployedUrl: `http://localhost:${exposedPort}`,
    });
    await new Promise(r => setTimeout(r, 12000));
    return `http://localhost:${exposedPort}`;
  }

  /**
   * Called only after all workflow nodes have completed
   * Decrements reference count, and if 0, actually tears down deployment
   */
  async cleanup(workflowId) {
    const info = this.activeContainers.get(workflowId);
    if (!info) return;
    info.refCount = (info.refCount || 1) - 1;
    if (info.refCount > 0) return;
    // Clean up containers and temp files
    try {
      if (info.containerId) {
        await execPromise(`docker stop "${info.containerId}"`);
        await execPromise(`docker rm "${info.containerId}"`);
        if (info.imageId) await execPromise(`docker rmi "${info.imageId}"`);
      } else if (info.composePath) {
        await execPromise(`docker-compose down`, { cwd: info.composePath });
      }
      const repoPath = path.join(this.getTempDir(), `vulncraft_${workflowId}`);
      await execPromise(this.getRemoveCommand(repoPath));
    } catch {}
    this.activeContainers.delete(workflowId);
  }
}

module.exports = new EphemeralDeployer();
