import streamlit as st
from ner_entity_annotator import ner_entity_annotator

# Add some test code to play with the component while it's in development.
# During development, we can run this just as we would any other Streamlit
# app: `$ streamlit run ner_entity_annotator/example.py`

st.subheader("Component demo")
st.text("Select text to add new entities")

text = "Welcome to the Bank of China."
spans = [
    {"start_token": 15, "end_token": 28, "label": "ORG"},
]

result = ner_entity_annotator(
    text=text,
    spans=spans,
    labels=["ORG", "GPE"],
    options={
        "disable_span_position_edit": True
    }
)

st.json(result)