"""
Facebook DOM Selectors
Centralized selectors for Facebook Marketplace automation
Updated regularly as Facebook changes their UI
"""

class FacebookSelectors:
    """
    CSS/XPath selectors for Facebook elements
    Grouped by feature area
    """
    
    # ========== LOGIN SELECTORS ==========
    LOGIN = {
        'email_input': 'input#email',
        'password_input': 'input#pass',
        'login_button': 'button[name="login"]',
        'login_button_alt': '[data-testid="royal_login_button"]',
        
        # 2FA
        'two_fa_input': 'input#approvals_code',
        'two_fa_submit': 'button#checkpointSubmitButton',
        'two_fa_remember': 'input[name="name_action_selected"]',
        
        # Checkpoint/Security
        'checkpoint_container': '#checkpoint_wrapper',
        'trust_browser_button': 'button[value="save_device"]',
        
        # Login success indicators
        'logged_in_indicator': '[aria-label="Account"]',
        'profile_menu': '[aria-label="Your profile"]',
        'home_feed': '[role="feed"]'
    }
    
    # ========== MARKETPLACE SELECTORS ==========
    MARKETPLACE = {
        # Navigation
        'marketplace_link': '[aria-label="Marketplace"]',
        'create_listing_button': '[aria-label="Create new listing"]',
        'create_new_button_text': '//span[contains(text(), "Create new listing")]',
        
        # Listing type selection
        'item_for_sale': '//span[contains(text(), "Item for Sale")]',
        'vehicle_for_sale': '//span[contains(text(), "Vehicle for Sale")]',
        'property_for_rent': '//span[contains(text(), "Property for Rent")]',
        
        # Common form fields
        'title_input': '[aria-label="Title"]',
        'price_input': '[aria-label="Price"]',
        'description_input': '[aria-label="Description"]',
        'location_input': '[aria-label="Location"]',
        
        # Category selection
        'category_dropdown': '[aria-label="Category"]',
        'category_search': '[placeholder="Search categories"]',
        
        # Condition
        'condition_dropdown': '[aria-label="Condition"]',
        'condition_new': '//span[text()="New"]',
        'condition_used_like_new': '//span[text()="Used - Like New"]',
        'condition_used_good': '//span[text()="Used - Good"]',
        'condition_used_fair': '//span[text()="Used - Fair"]',
        
        # Photos
        'photo_upload_input': 'input[type="file"][accept*="image"]',
        'photo_upload_button': '[aria-label="Add photos"]',
        'photo_container': '[data-testid="photo-attachment-container"]',
        
        # Vehicle specific
        'vehicle_year': '[aria-label="Year"]',
        'vehicle_make': '[aria-label="Make"]',
        'vehicle_model': '[aria-label="Model"]',
        'vehicle_mileage': '[aria-label="Mileage"]',
        'vehicle_vin': '[aria-label="VIN"]',
        'vehicle_body_style': '[aria-label="Body Style"]',
        'vehicle_fuel_type': '[aria-label="Fuel Type"]',
        'vehicle_transmission': '[aria-label="Transmission"]',
        'vehicle_exterior_color': '[aria-label="Exterior Color"]',
        'vehicle_interior_color': '[aria-label="Interior Color"]',
        
        # Submit
        'next_button': '//span[text()="Next"]',
        'publish_button': '[aria-label="Publish"]',
        'publish_button_text': '//span[text()="Publish"]',
        
        # Success indicators
        'listing_success': '//span[contains(text(), "Your listing is now published")]',
        'listing_pending': '//span[contains(text(), "pending")]',
        
        # Listing management
        'your_listings': '//span[text()="Your listings"]',
        'active_listings': '//span[text()="Active"]',
        'pending_listings': '//span[text()="Pending"]',
        'drafts': '//span[text()="Drafts"]'
    }
    
    # ========== GROUPS SELECTORS ==========
    GROUPS = {
        'groups_link': '[aria-label="Groups"]',
        'your_groups': '//span[text()="Your groups"]',
        'group_search': 'input[placeholder="Search groups"]',
        
        # Posting to group
        'create_post_button': '[aria-label="Create post"]',
        'write_something': '[aria-label="Write something..."]',
        'post_button': '[aria-label="Post"]',
        
        # Marketplace in groups
        'sell_something': '//span[contains(text(), "Sell Something")]',
        'sell_button': '[aria-label="Sell"]'
    }
    
    # ========== COMMON SELECTORS ==========
    COMMON = {
        # Dialogs
        'close_dialog': '[aria-label="Close"]',
        'confirm_button': '//span[text()="Confirm"]',
        'cancel_button': '//span[text()="Cancel"]',
        
        # Loading states
        'loading_spinner': '[role="progressbar"]',
        'loading_overlay': '[data-visualcompletion="loading-state"]',
        
        # Errors
        'error_message': '[role="alert"]',
        'error_dialog': '[aria-label="Error"]',
        
        # Notifications
        'notification_badge': '[aria-label="Notifications"]',
        
        # Generic buttons/inputs
        'see_more': '//span[text()="See more"]',
        'dropdown_option': '[role="option"]',
        'checkbox': '[role="checkbox"]',
        'radio': '[role="radio"]'
    }
    
    # ========== URLS ==========
    URLS = {
        'login': 'https://www.facebook.com/login',
        'home': 'https://www.facebook.com/',
        'marketplace': 'https://www.facebook.com/marketplace/',
        'marketplace_create': 'https://www.facebook.com/marketplace/create/item/',
        'marketplace_create_vehicle': 'https://www.facebook.com/marketplace/create/vehicle/',
        'marketplace_you': 'https://www.facebook.com/marketplace/you/',
        'groups': 'https://www.facebook.com/groups/',
        'settings': 'https://www.facebook.com/settings/'
    }
    
    @classmethod
    def get_selector(cls, category: str, name: str) -> str:
        """
        Get a selector by category and name
        
        Args:
            category: LOGIN, MARKETPLACE, GROUPS, COMMON
            name: Selector name within category
            
        Returns:
            Selector string
        """
        category_map = {
            'LOGIN': cls.LOGIN,
            'MARKETPLACE': cls.MARKETPLACE,
            'GROUPS': cls.GROUPS,
            'COMMON': cls.COMMON,
            'URLS': cls.URLS
        }
        
        cat = category_map.get(category.upper())
        if not cat:
            raise ValueError(f"Unknown category: {category}")
        
        selector = cat.get(name)
        if not selector:
            raise ValueError(f"Unknown selector: {category}.{name}")
        
        return selector
    
    @classmethod
    def is_xpath(cls, selector: str) -> bool:
        """Check if selector is XPath (starts with //)"""
        return selector.startswith('//')


# Vehicle category mappings
VEHICLE_MAKES = [
    'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW',
    'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari',
    'Fiat', 'Ford', 'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti',
    'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus',
    'Lincoln', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mini',
    'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Rolls-Royce', 'Subaru',
    'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
]

BODY_STYLES = [
    'Convertible', 'Coupe', 'Hatchback', 'Minivan', 'Pickup Truck',
    'Sedan', 'Station Wagon', 'SUV', 'Van'
]

FUEL_TYPES = [
    'Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other'
]

TRANSMISSIONS = [
    'Automatic', 'Manual', 'Other'
]

EXTERIOR_COLORS = [
    'Beige', 'Black', 'Blue', 'Brown', 'Gold', 'Gray', 'Green',
    'Orange', 'Purple', 'Red', 'Silver', 'White', 'Yellow', 'Other'
]
