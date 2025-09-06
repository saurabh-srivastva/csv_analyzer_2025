import pandas as pd
import io
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize the Flask application
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS) to allow the frontend to communicate with this backend
# frontend URL from Render
CORS(app, origins="https://csv-analyzer-2025-frontend.onrender.com")
# --- Helper function to process the uploaded file ---
def process_file_to_dataframe(file_request):
    if 'file' not in file_request.files:
        return None, ({'error': 'No file part in the request'}, 400)
    
    file = file_request.files['file']
    if file.filename == '':
        return None, ({'error': 'No selected file'}, 400)

    if file and file.filename.endswith('.csv'):
        try:
            csv_content = file.stream.read().decode('utf-8')
            csv_file = io.StringIO(csv_content)
            df = pd.read_csv(csv_file)
            return df, None
        except Exception as e:
            return None, ({'error': f'Error processing file: {e}'}, 500)
    else:
        return None, ({'error': 'Invalid file type. Please upload a CSV file.'}, 400)

@app.route('/analyze', methods=['POST'])
def analyze_csv():
    df, error_response = process_file_to_dataframe(request)
    if error_response:
        return jsonify(error_response[0]), error_response[1]

    try:
        # Get the number of rows for the preview, default to 5
        num_rows = int(request.form.get('rows', 5))
        if num_rows < 1:
            num_rows = 5
        
        # Generate HTML for the data preview
        head_html = df.head(num_rows).to_html(classes='min-w-full divide-y divide-gray-300 bg-white rounded-lg shadow', border=0, index=False)
        
        # Generate column descriptions
        description_data = []
        null_counts = df.isnull().sum()
        for col in df.columns:
            description_data.append({
                'column': col,
                'non_null_count': int(df[col].count()),
                'null_count': int(null_counts[col]),
                'dtype': str(df[col].dtype),
            })
        
        # Return the complete analysis
        return jsonify({
            'filename': request.files['file'].filename,
            'rows': len(df),
            'columns': len(df.columns),
            'head_html': head_html,
            'description': description_data
        })
    except Exception as e:
        return jsonify({'error': f'Error during analysis: {e}'}), 500

@app.route('/describe', methods=['POST'])
def describe_columns():
    df, error_response = process_file_to_dataframe(request)
    if error_response:
        return jsonify(error_response[0]), error_response[1]
    
    # Get the list of columns to describe from the form data
    selected_columns = request.form.getlist('columns')
    if not selected_columns:
        return jsonify({'error': 'No columns selected for description.'}), 400

    try:
        # Filter the DataFrame to only include selected numeric columns
        # Also, perform a sanity check to ensure columns exist
        existing_cols = [col for col in selected_columns if col in df.columns]
        numeric_df = df[existing_cols].select_dtypes(include='number')

        if numeric_df.empty:
            return jsonify({'error': 'Selected columns are not numeric or do not exist.'}), 400

        # Use pandas' describe() method
        stats_df = numeric_df.describe()
        
        # Convert the resulting statistics DataFrame to HTML
        stats_html = stats_df.to_html(classes='min-w-full divide-y divide-gray-300 bg-white rounded-lg shadow', border=0)
        
        return jsonify({'stats_html': stats_html})

    except Exception as e:
        return jsonify({'error': f'Error generating statistics: {e}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)  # --- Helper function to process the uploaded file ---