rom selenium import webdriver
import boto3
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import os


from bs4 import BeautifulSoup

# Function to get URL from Parameter store
def get_petsite_url(parameter_name):
    
    print("Getting SSM Parameter")
    
    region_name = os.environ.get('AWS_REGION', 'us-west-2')
    
    session = boto3.Session(region_name=str(region_name))
    ssm_client = session.client('ssm')
    
    try:
        response = ssm_client.get_parameter(
            Name=parameter_name,
            WithDecryption=True  # Specify if the parameter is encrypted
        )
        
        print("SSM Parameter Found")
        
        return response['Parameter']['Value']
    
    except ssm_client.exceptions.ParameterNotFound:
        print("Parameter not found.")
        return None
    except Exception as e:
        print(f"Error retrieving parameter '{parameter_name}': {str(e)}")
        return None

# Funciton to configure chrome web driver
def configure_web_driver():
    print("Configuring Web Driver.")
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    return driver

# Function to search and adopt pets
def search_by_color_and_type(driver,home_url, color, pet_type):
    
    chrome_driver.get(home_url)
    print(f"Searching for pet type of {pet_type} and color {color}")

    
    type_dropdown = Select(chrome_driver.find_element(By.ID,"Varieties_SelectedPetType"))
    type_dropdown.select_by_visible_text(pet_type)
    
    color_dropdown = Select(chrome_driver.find_element(By.ID,"Varieties_SelectedPetColor"))
    color_dropdown.select_by_visible_text(color)
    
    element=chrome_driver.find_element(By.ID,"searchpets")
    element.click()
 
    #print(chrome_driver.current_url)

    try: 
        # Click the "Take me home" button by submitting the form
        pet_form = chrome_driver.find_element(By.XPATH, '//form[contains(@action, "/adoption/takemehome")]')
        pet_form.submit()
        
        # Parse the HTML with BeautifulSoup
        soup = BeautifulSoup(chrome_driver.page_source,'html.parser')
        
        # Find the pet name element within the current pet item
        pet_name_element = soup.find('div', class_='pet-name')
        if pet_name_element:
            pet_name_text = pet_name_element.find('span').get_text(strip=True)

            print(f"Adopting the pet named: {pet_name_text}")

            payment_form = chrome_driver.find_element(By.XPATH, "//form[@action='/Payment/MakePayment']")
            payment_form.submit()
        else:
            print("No pet found")
    except NoSuchElementException:
        # Handle the case where the form is not found
        print("Pet form not found. Handle this case accordingly.")

# Function to loop through pet types and colors
def adopt_pets_in_loop(chrome_driver, petsite_url, colors, types):
    while True:
        for color in colors:
            for pet_type in types:
                search_by_color_and_type(chrome_driver, petsite_url, color, pet_type)
                
colors = ["Brown", "Black", "White"]
types = ["Puppy", "Kitten", "Bunny"]

#Get site URL
pet_site_url_parameter_name = '/petstore/petsiteurl'
petsite_url = get_petsite_url(pet_site_url_parameter_name)

chrome_driver = configure_web_driver()

try:
    adopt_pets_in_loop(chrome_driver, petsite_url, colors, types)
    
except Exception as e:
    
    print(f"An unexpected error occurred: {e}")
    
finally:
    chrome_driver.quit()