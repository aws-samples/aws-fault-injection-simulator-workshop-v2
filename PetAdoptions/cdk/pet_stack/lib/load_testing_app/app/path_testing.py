from selenium import webdriver
import boto3
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
from bs4 import BeautifulSoup
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Custom exceptions
class ParameterStoreError(Exception):
    """Raised when there's an error retrieving a parameter from the AWS Parameter Store."""
    pass

class WebDriverError(Exception):
    """Raised when there's an error configuring or using the web driver."""
    pass

class PetSearchError(Exception):
    """Raised when there's an error searching for or adopting a pet."""
    pass

# Function to get URL from Parameter store
def get_petsite_url(parameter_name):
    logging.info(f"Getting SSM Parameter {parameter_name}")
    
    region_name = os.environ.get('AWS_REGION', 'us-west-2')
    
    session = boto3.Session(region_name=str(region_name))
    ssm_client = session.client('ssm')
    
    try:
        response = ssm_client.get_parameter(
            Name=parameter_name,
            WithDecryption=True  # Specify if the parameter is encrypted
        )
        
        logging.info("SSM Parameter Found")
        
        return response['Parameter']['Value']
    
    except ssm_client.exceptions.ParameterNotFound as e:
        raise ParameterStoreError(f"Parameter not found: {str(e)}")
    except Exception as e:
        raise ParameterStoreError(f"Error retrieving parameter '{parameter_name}': {str(e)}")

# Function to configure chrome web driver
def configure_web_driver():
    logging.info("Configuring Web Driver.")
    try:
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        return driver
    except Exception as e:
        raise WebDriverError(f"Error configuring web driver: {str(e)}")

# Function to search and adopt pets
def search_by_color_and_type(driver, home_url, color, pet_type):
    
    '''
    #Navigate to home page and view pets already adopted
    try:
        driver.get(home_url)

        # Find the "See Adoption List" link element by ID
        adoption_list_link = driver.find_element(By.ID, "seeadoptionlist")

        # Click on the link
        adoption_list_link.click()
    except NoSuchElementException as e:
        raise PetSearchError(f"Error selecting pet type or color: {str(e)}")
    '''
    #Search for pet by color and type
    try:
        driver.get(home_url)
        logging.info(f"Navigating to home page {home_url}")
        logging.info(f"Searching for pet type of {pet_type} and color {color}")
        
        type_dropdown = Select(driver.find_element(By.ID, "Varieties_SelectedPetType"))
        type_dropdown.select_by_visible_text(pet_type)
        
        color_dropdown = Select(driver.find_element(By.ID, "Varieties_SelectedPetColor"))
        color_dropdown.select_by_visible_text(color)
        
        element = driver.find_element(By.ID, "searchpets")
        element.click()
    except NoSuchElementException as e:
        raise PetSearchError(f"Error selecting pet type or color: {str(e)}")
    
    try:
        # Click the "Take me home" button by submitting the form
        wait = WebDriverWait(driver, 10)
        pet_form = wait.until(EC.presence_of_element_located((By.XPATH, '//form[contains(@action, "/adoption/takemehome")]')))
        pet_form.submit()

        # Parse the HTML with BeautifulSoup
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        # Find the pet name element within the current pet item
        pet_name_element = soup.find('div', class_='pet-name')
        pet_name_text = pet_name_element.find('span').get_text(strip=True)

    except (NoSuchElementException, TimeoutException) as e:
        raise PetSearchError(f"Error finding or submitting pet form: {str(e)}")
    
    try:
        payment_form = driver.find_element(By.XPATH, "//form[@action='/Payment/MakePayment']")
        payment_form.submit()
    
        logging.info(f"Successfully adopted the pet named: {pet_name_text}")

    except NoSuchElementException as e:
        raise PetSearchError(f"Error submitting payment form: {str(e)}")

    try:
        driver.get(home_url)
        # Find the "See Adoption List" link element by ID
        adoption_list_link = driver.find_element(By.ID, "seeadoptionlist")

        # Click on the link
        adoption_list_link.click()

        driver.get(driver.current_url)
        
        logging.info("Successfully navigated to see adoption list")
    
    except NoSuchElementException as e:
        raise PetSearchError(f"Error navigating to adoption list: {str(e)}")

colors = ["Brown", "Black", "White"]
types = ["Puppy", "Kitten", "Bunny"]

# Get site URL
pet_site_url_parameter_name = '/petstore/petsiteurl'

try:
    petsite_url = get_petsite_url(pet_site_url_parameter_name)
except ParameterStoreError as e:
    logging.error(f"Error retrieving pet site URL: {str(e)}")
    exit(1)

try:
    while True:
        for color in colors:
            for pet_type in types:
                try:
                    chrome_driver = configure_web_driver()
                    search_by_color_and_type(chrome_driver, petsite_url, color, pet_type)
                    chrome_driver.quit()
                except (WebDriverError, PetSearchError) as e:
                    logging.error(f"Error during pet search: {str(e)}")
                    if isinstance(e, WebDriverError):
                        chrome_driver.quit()

except Exception as e:
    logging.error(f"An unexpected error occurred: {e}")
    
finally:
    exit()