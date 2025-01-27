# NER Entity Annotator
A Streamlit component for visualizing and modifying Named Entity Recognition (NER) annotations in the spaCy displacy entity recognizer style. This works well for NER classes that are not overlapping.

<img src="https://github.com/forward-it/ner-entity-annotator/raw/main/example.png" width="893">

### Key Features:
- **Visualization**: Displays NER annotations in a clear and intuitive style.
- **Interactivity**: Allows you to modify NER annotations directly in the interface.

The implementation leverages code partially ported from Python to React, inspired by the [spaCy repository](https://github.com/explosion/spaCy/tree/master/spacy/displacy).
For more details about the spaCy entity recognizer component, visit [this page](https://spacy.io/usage/visualizers#ent).


## Installation instructions

```sh
pip install ner_entity_annotator
```

## Usage instructions

```python
import streamlit as st

from ner_entity_annotator import ner_entity_annotator

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
```

## Development
To set up and run the development environment, follow these steps:

Navigate to the ner_entity_annotator/frontend directory and run:

```
npm install    # Initialize the project and install npm dependencies
npm run start  # Start the Webpack dev server
```

Then go to the project root and run the example app:
```
pip install -e . # install template as editable package
streamlit run ner_entity_annotator/example.py # run the example
```

