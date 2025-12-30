#!/bin/bash

echo "🚀 Setting up GitHub PR Testing Integration..."

# Install dependencies
echo "📦 Installing dependencies..."
cd /app
pip install -r requirements.txt

# Run migrations
echo "🗄️  Running database migrations..."
python manage.py makemigrations github_integration
python manage.py migrate

# Create superuser if doesn't exist
echo "👤 Creating superuser (skip if exists)..."
python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    print('✅ Superuser created: admin/admin')
else:
    print('ℹ️  Superuser already exists')
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set environment variables (GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET)"
echo "2. Configure GitHub webhook"
echo "3. Add repositories to monitor in Django admin"
echo ""
echo "Access admin at: http://localhost:8000/admin/"
echo "Test webhook at: http://localhost:8000/api/github/webhook/test/"
