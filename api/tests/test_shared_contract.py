import json
from pathlib import Path

import pytest

from billing.rules import DomainError, calculate

fixtures = json.loads((Path(__file__).parents[2] / "src/data/billing-contract.json").read_text())


@pytest.mark.parametrize("fixture", fixtures, ids=[v["name"] for v in fixtures])
def test_shared_web_and_python_money_contract(fixture):
    if fixture.get("error"):
        with pytest.raises(DomainError):
            calculate(fixture["items"], fixture["options"])
    else:
        result = calculate(fixture["items"], fixture["options"])
        for key, value in fixture["expected"].items():
            assert result[key] == value
