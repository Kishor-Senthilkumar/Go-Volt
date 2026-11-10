from app.services.llm import parse_text_tool_call


def test_parse_text_tool_call_accepts_model_json_parameters():
    assert parse_text_tool_call(
        '{"name":"find_chargers","parameters":{"distance":null,"location_query":"Chennai"}}'
    ) == {
        "function": {
            "name": "find_chargers",
            "arguments": {"distance": None, "location_query": "Chennai"},
        }
    }


def test_parse_text_tool_call_accepts_fenced_function_arguments():
    assert parse_text_tool_call(
        '```json\n{"function":{"name":"find_chargers","arguments":{"distance":5}}}\n```'
    ) == {
        "function": {
            "name": "find_chargers",
            "arguments": {"distance": 5},
        }
    }


def test_parse_text_tool_call_recovers_arguments_from_truncated_model_output():
    assert parse_text_tool_call(
        '{"name":"find_chargers","parameters":{"distance":null,"location_query":"","connector_types":["CCS","CHAdeMO"'
    ) == {
        "function": {
            "name": "find_chargers",
            "arguments": {"distance": None, "location_query": ""},
        }
    }


def test_parse_text_tool_call_ignores_regular_or_unsupported_json():
    assert parse_text_tool_call("I can help find chargers.") is None
    assert parse_text_tool_call('{"name":"other_tool","parameters":{}}') is None
    assert parse_text_tool_call('{"name":"find_chargers","parameters":[]}') is None
