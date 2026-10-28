import uuid

import pytest

from billing.models import Invoice
from billing.repository import execute, workspace_for
from billing.rules import DomainError, today


@pytest.mark.django_db
def test_incomplete_business_cannot_issue_or_reserve_numbers(user):
    user.business_address = ""
    user.save()

    def command(action, *args):
        return execute(user, action, list(args), uuid.uuid4())

    customer = command(
        "addCustomer", {"name": "Buyer", "email": "buyer@example.test", "mobile": "9876543210"}
    )
    product = command("addProduct", {"name": "Service", "price": 100})
    values = {
        "date": today(),
        "customer": customer["_id"],
        "billingAddress": "Mumbai",
        "lineItems": [{"product": product["_id"], "quantity": 1}],
    }
    with pytest.raises(DomainError, match="business name and address"):
        command("addBill", values)
    assert not Invoice.objects.exists()
    assert workspace_for(user).sequences == {}
