from django.urls import include, path, re_path

from billing import views
from billing.historical_views import HistoricalSalesCommitView, HistoricalSalesPreviewView

urlpatterns = [
    path("api/v1/health/live", views.live),
    path("api/v1/health/ready", views.ready),
    path("api/v1/config", views.config),
    path("api/v1/me", views.MeView.as_view()),
    path("api/v1/account/delete", views.AccountDeleteView.as_view()),
    path("api/v1/historical-sales/preview", HistoricalSalesPreviewView.as_view()),
    path("api/v1/historical-sales/commit", HistoricalSalesCommitView.as_view()),
    path("api/v1/workspace", views.WorkspaceView.as_view()),
    path("api/v1/actions/<str:action>", views.ActionView.as_view()),
    path("api/v1/import/preview", views.ImportPreviewView.as_view()),
    path("api/v1/invoices/preview", views.InvoicePreviewView.as_view()),
    path("api/v1/import/commit", views.ImportCommitView.as_view()),
    path("_allauth/", include("allauth.headless.urls")),
    path("accounts/", include("allauth.urls")),
    re_path(r"^(?P<route>.*)$", views.web_app),
]
