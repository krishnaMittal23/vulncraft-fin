"""
GitHub App Authentication Service
Handles JWT generation and installation token management
"""

import jwt
import time
import requests
import logging
from django.conf import settings
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class GitHubAppAuth:
    """Handle GitHub App authentication and token generation."""
    
    @staticmethod
    def generate_jwt():
        """
        Generate JWT for GitHub App authentication.
        
        Returns:
            str: JWT token valid for 10 minutes
        """
        try:
            # Try to read from file
            if settings.GITHUB_PRIVATE_KEY_PATH.exists():
                with open(settings.GITHUB_PRIVATE_KEY_PATH, 'r') as key_file:
                    private_key = key_file.read()
            # Try to read from environment variable (base64 encoded)
            elif settings.GITHUB_PRIVATE_KEY:
                import base64
                private_key = base64.b64decode(settings.GITHUB_PRIVATE_KEY).decode('utf-8')
            else:
                raise ValueError("GitHub App private key not configured")
            
            payload = {
                'iat': int(time.time()),  # Issued at time
                'exp': int(time.time()) + (10 * 60),  # JWT expiration (10 minutes)
                'iss': settings.GITHUB_APP_ID  # GitHub App's identifier
            }
            
            encoded_jwt = jwt.encode(payload, private_key, algorithm='RS256')
            return encoded_jwt
            
        except Exception as e:
            logger.error(f"Failed to generate JWT: {str(e)}")
            raise
    
    @staticmethod
    def get_installation_token(installation_id):
        """
        Get an installation access token for a specific installation.
        
        Args:
            installation_id (int): The GitHub App installation ID
            
        Returns:
            str: Installation access token valid for 1 hour
        """
        try:
            jwt_token = GitHubAppAuth.generate_jwt()
            
            url = f'https://api.github.com/app/installations/{installation_id}/access_tokens'
            headers = {
                'Authorization': f'Bearer {jwt_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.post(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            token_data = response.json()
            logger.info(f"Generated installation token for installation {installation_id}")
            
            return token_data['token']
            
        except Exception as e:
            logger.error(f"Failed to get installation token: {str(e)}")
            raise
    
    @staticmethod
    def get_installations():
        """
        Get all installations of this GitHub App.
        
        Returns:
            list: List of installation objects
        """
        try:
            jwt_token = GitHubAppAuth.generate_jwt()
            
            url = 'https://api.github.com/app/installations'
            headers = {
                'Authorization': f'Bearer {jwt_token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            installations = response.json()
            logger.info(f"Found {len(installations)} installations")
            
            return installations
            
        except Exception as e:
            logger.error(f"Failed to get installations: {str(e)}")
            raise
    
    @staticmethod
    def get_installation_repositories(installation_id):
        """
        Get all repositories accessible to a specific installation.
        
        Args:
            installation_id (int): The GitHub App installation ID
            
        Returns:
            list: List of repository objects
        """
        try:
            token = GitHubAppAuth.get_installation_token(installation_id)
            
            url = f'https://api.github.com/installation/repositories'
            headers = {
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            repositories = data.get('repositories', [])
            
            logger.info(f"Found {len(repositories)} repositories for installation {installation_id}")
            
            return repositories
            
        except Exception as e:
            logger.error(f"Failed to get installation repositories: {str(e)}")
            raise
    
    @staticmethod
    def is_configured():
        """
        Check if GitHub App is properly configured.
        
        Returns:
            bool: True if all required settings are present
        """
        has_app_id = bool(settings.GITHUB_APP_ID)
        has_private_key = (
            settings.GITHUB_PRIVATE_KEY_PATH.exists() or 
            bool(settings.GITHUB_PRIVATE_KEY)
        )
        
        return has_app_id and has_private_key
