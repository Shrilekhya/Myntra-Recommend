import sys
import json
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import Pipeline


df = pd.read_csv('C:\\Works\\Myntra\\Backend\\styles.csv', on_bad_lines='skip')

# Drop rows where productDisplayName is NaN
df.dropna(subset=['productDisplayName'], inplace=True)

# Reset index if needed
df.reset_index(drop=True, inplace=True)

# Define columns for preprocessing
text_column = 'productDisplayName'  # Assuming this is the product name or description
categorical_columns = ['gender', 'masterCategory', 'subCategory', 'articleType', 'season', 'usage']  # List of categorical columns

# Preprocessing pipeline
preprocessor = ColumnTransformer(
    transformers=[
        ('tfidf', TfidfVectorizer(stop_words='english'), text_column),
        ('onehot', OneHotEncoder(sparse=False, handle_unknown='ignore'), categorical_columns)
    ],
    remainder='drop'
)

# Pipeline for recommendation
pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('cosine_similarity', 'passthrough')  # Placeholder for similarity calculation
])

# Fit the preprocessing pipeline
pipeline.fit(df)

# Function to recommend similar products
def recommend_similar_products(input_data, top_n=5):
    processed_input = pipeline.transform(pd.DataFrame([input_data]))  # Wrap input_data in a DataFrame
    similarities = cosine_similarity(processed_input, pipeline.transform(df))
    similar_indices = similarities.argsort(axis=1)[0, :-top_n-1:-1]
    return df.iloc[similar_indices].to_dict(orient='records')

# Load input data from the command line argument
input_data = json.loads(sys.argv[1])

# Recommend similar products
recommended_products = recommend_similar_products(input_data)

# Print the recommendations as JSON
print(json.dumps(recommended_products))
