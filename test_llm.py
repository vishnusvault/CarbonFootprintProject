import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.environ['GOOGLE_API_KEY'])
config = types.GenerateContentConfig(
    temperature=0.3,
    max_output_tokens=1024,
    response_mime_type='application/json',
)
prompt = '''You are a JSON generator. Return the following format:
{
  "summary": "Detailed summary",
  "suggestions": ["1", "2"],
  "fact": "Did you know",
  "sources": []
}
User data: car_petrol 52.2, IN, car, mixed.
'''
try:
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=prompt,
        config=config
    )
    print('RAW TEXT:')
    print(response.text)
except Exception as e:
    print('ERROR:', e)
