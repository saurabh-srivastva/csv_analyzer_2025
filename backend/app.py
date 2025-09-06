import pandas as pd
import io
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize the Flask application
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS) to allow the frontend to communicate with this backend
CORS(app, origins="https://csv-analyzer-frontend.onrender.com") # Make sure this matches your frontend URL

# --- Helper function to process the uploaded file ---
def process_file_to_dataframe(file_request):
    if 'file' not in file_request.files:
        return None, ({'error': 'No file part in the request'}, 400)
    
    file = file_request.files['file']
    if file.filename == '':
        return None, ({'error': 'No selected file'}, 400)

    if file and file.filename.endswith('.csv'):
        try:
            # It's safer to provide an encoding or handle potential errors
            csv_content = file.stream.read().decode('utf-8', errors='replace')
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
    
    selected_columns = request.form.getlist('columns')
    if not selected_columns:
        return jsonify({'error': 'No columns selected for description.'}), 400

    try:
        existing_cols = [col for col in selected_columns if col in df.columns]
        numeric_df = df[existing_cols].select_dtypes(include='number')

        if numeric_df.empty:
            return jsonify({'error': 'Selected columns are not numeric or do not exist.'}), 400

        stats_df = numeric_df.describe()
        stats_html = stats_df.to_html(classes='min-w-full divide-y divide-gray-300 bg-white rounded-lg shadow', border=0)
        
        return jsonify({'stats_html': stats_html})

    except Exception as e:
        return jsonify({'error': f'Error generating statistics: {e}'}), 500

@app.route('/plot', methods=['POST'])
def get_plot_data():
    df, error_response = process_file_to_dataframe(request)
    if error_response:
        return jsonify(error_response[0]), error_response[1]

    plot_type = request.form.get('plot_type')
    column_name = request.form.get('column')

    if not column_name:
        return jsonify({'error': 'Column name not provided.'}), 400
    
    if column_name not in df.columns:
        return jsonify({'error': f'Column "{column_name}" not found in file.'}), 400

    try:
        # For categorical data, get value counts. Limit to top 15 for readability.
        counts = df[column_name].value_counts().nlargest(15)
        
        # Prepare data in a format Chart.js understands
        plot_data = {
            'labels': counts.index.astype(str).tolist(), # Ensure labels are strings
            'data': counts.values.tolist()
        }
        
        return jsonify(plot_data)

    except Exception as e:
        return jsonify({'error': f'Could not generate plot data: {e}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)