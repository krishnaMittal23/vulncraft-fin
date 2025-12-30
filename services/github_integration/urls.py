from django.urls import path
from . import views

urlpatterns = [
    path('webhook/', views.github_webhook, name='github_webhook'),
    path('webhook/netlify/', views.netlify_webhook, name='netlify_webhook'),
    path('webhook/test/', views.webhook_test, name='webhook_test'),
    path('monitored/', views.monitored_repositories, name='monitored_repositories'),
    path('monitored/<int:repo_id>/', views.delete_monitored_repository, name='delete_monitored_repository'),
]
