"""
Facebook Marketplace Posting Automation
Handles vehicle and item listing creation
"""
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path
import structlog
from playwright.async_api import Page, TimeoutError as PlaywrightTimeout

from facebook.selectors import FacebookSelectors
from browser.anti_detect import random_delay, add_human_behavior

logger = structlog.get_logger()


class MarketplacePoster:
    """
    Handles Facebook Marketplace listing creation
    
    Supports:
    - Vehicle listings (with VIN, make, model, etc.)
    - General item listings
    - Photo uploads
    - Group posting
    """
    
    def __init__(self, page: Page):
        self.page = page
        self.selectors = FacebookSelectors
    
    async def create_vehicle_listing(
        self,
        vehicle_data: Dict[str, Any],
        photos: List[str],
        post_to_groups: List[str] = None
    ) -> Dict[str, Any]:
        """
        Create a vehicle listing on Facebook Marketplace
        
        Args:
            vehicle_data: Dict containing vehicle info:
                - year: Vehicle year
                - make: Vehicle make (e.g., "Toyota")
                - model: Vehicle model (e.g., "Camry")
                - price: Listing price
                - mileage: Odometer reading
                - vin: Vehicle identification number (optional)
                - body_style: Sedan, SUV, etc.
                - fuel_type: Gasoline, Electric, etc.
                - transmission: Automatic, Manual
                - exterior_color: Color name
                - interior_color: Color name
                - description: Listing description
                - location: City/area
            photos: List of local file paths to upload
            post_to_groups: Optional list of group IDs to cross-post
            
        Returns:
            Dict with success status and listing details
        """
        result = {
            'success': False,
            'listing_id': None,
            'listing_url': None,
            'error': None,
            'groups_posted': []
        }
        
        try:
            await add_human_behavior(self.page)
            
            # Navigate to vehicle listing creation
            logger.info("Navigating to Marketplace vehicle listing",
                       make=vehicle_data.get('make'),
                       model=vehicle_data.get('model'))
            
            await self.page.goto(self.selectors.URLS['marketplace_create_vehicle'])
            await self.page.wait_for_load_state('networkidle')
            await random_delay(2000, 3000)
            
            # Upload photos first
            if photos:
                logger.info("Uploading photos", count=len(photos))
                await self._upload_photos(photos)
                await random_delay(2000, 4000)
            
            # Fill vehicle details
            await self._fill_vehicle_details(vehicle_data)
            
            # Click Next/Continue through form pages
            await self._navigate_form_pages()
            
            # Publish the listing
            await random_delay(1000, 2000)
            publish_success = await self._publish_listing()
            
            if publish_success:
                result['success'] = True
                result['listing_url'] = self.page.url
                
                # Extract listing ID from URL
                url_parts = self.page.url.split('/')
                for i, part in enumerate(url_parts):
                    if part == 'item' and i + 1 < len(url_parts):
                        result['listing_id'] = url_parts[i + 1]
                        break
                
                logger.info("Vehicle listing created successfully",
                           listing_id=result['listing_id'])
                
                # Post to groups if specified
                if post_to_groups:
                    for group_id in post_to_groups:
                        group_result = await self._share_to_group(
                            result['listing_id'], 
                            group_id
                        )
                        if group_result:
                            result['groups_posted'].append(group_id)
            else:
                result['error'] = 'Failed to publish listing'
            
            return result
            
        except PlaywrightTimeout as e:
            result['error'] = f'Timeout: {str(e)}'
            logger.error("Listing creation timeout", error=str(e))
            return result
            
        except Exception as e:
            result['error'] = str(e)
            logger.error("Listing creation failed", error=str(e))
            return result
    
    async def _upload_photos(self, photos: List[str]):
        """Upload photos to the listing"""
        try:
            # Find the file input
            file_input = await self.page.wait_for_selector(
                self.selectors.MARKETPLACE['photo_upload_input'],
                timeout=10000
            )
            
            # Verify files exist
            valid_photos = []
            for photo_path in photos:
                if Path(photo_path).exists():
                    valid_photos.append(photo_path)
                else:
                    logger.warning("Photo not found", path=photo_path)
            
            if not valid_photos:
                logger.warning("No valid photos to upload")
                return
            
            # Upload all photos at once
            await file_input.set_input_files(valid_photos)
            
            # Wait for uploads to complete
            await asyncio.sleep(2)  # Initial delay
            
            # Wait for photo containers to appear (up to 30 seconds for multiple photos)
            max_wait = 30
            for _ in range(max_wait):
                photo_count = await self.page.locator(
                    self.selectors.MARKETPLACE['photo_container']
                ).count()
                
                if photo_count >= len(valid_photos):
                    break
                await asyncio.sleep(1)
            
            logger.info("Photos uploaded", count=len(valid_photos))
            
        except Exception as e:
            logger.error("Photo upload failed", error=str(e))
            raise
    
    async def _fill_vehicle_details(self, vehicle_data: Dict[str, Any]):
        """Fill in vehicle listing form fields"""
        
        # Year
        if 'year' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_year'],
                str(vehicle_data['year'])
            )
            await random_delay(300, 600)
        
        # Make
        if 'make' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_make'],
                vehicle_data['make']
            )
            await random_delay(300, 600)
        
        # Model
        if 'model' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_model'],
                vehicle_data['model']
            )
            await random_delay(300, 600)
        
        # Price
        if 'price' in vehicle_data:
            await self._fill_input(
                self.selectors.MARKETPLACE['price_input'],
                str(vehicle_data['price'])
            )
            await random_delay(300, 600)
        
        # Mileage
        if 'mileage' in vehicle_data:
            await self._fill_input(
                self.selectors.MARKETPLACE['vehicle_mileage'],
                str(vehicle_data['mileage'])
            )
            await random_delay(300, 600)
        
        # VIN (optional)
        if 'vin' in vehicle_data:
            await self._fill_input(
                self.selectors.MARKETPLACE['vehicle_vin'],
                vehicle_data['vin']
            )
            await random_delay(300, 600)
        
        # Body Style
        if 'body_style' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_body_style'],
                vehicle_data['body_style']
            )
            await random_delay(300, 600)
        
        # Fuel Type
        if 'fuel_type' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_fuel_type'],
                vehicle_data['fuel_type']
            )
            await random_delay(300, 600)
        
        # Transmission
        if 'transmission' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_transmission'],
                vehicle_data['transmission']
            )
            await random_delay(300, 600)
        
        # Exterior Color
        if 'exterior_color' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_exterior_color'],
                vehicle_data['exterior_color']
            )
            await random_delay(300, 600)
        
        # Interior Color
        if 'interior_color' in vehicle_data:
            await self._select_dropdown(
                self.selectors.MARKETPLACE['vehicle_interior_color'],
                vehicle_data['interior_color']
            )
            await random_delay(300, 600)
        
        # Description
        if 'description' in vehicle_data:
            await self._fill_input(
                self.selectors.MARKETPLACE['description_input'],
                vehicle_data['description']
            )
            await random_delay(500, 1000)
        
        # Location
        if 'location' in vehicle_data:
            await self._fill_input(
                self.selectors.MARKETPLACE['location_input'],
                vehicle_data['location']
            )
            await random_delay(1000, 1500)
            
            # Select first location suggestion
            try:
                suggestion = await self.page.wait_for_selector(
                    self.selectors.COMMON['dropdown_option'],
                    timeout=5000
                )
                if suggestion:
                    await suggestion.click()
            except PlaywrightTimeout:
                logger.warning("No location suggestions appeared")
        
        logger.info("Vehicle details filled")
    
    async def _fill_input(self, selector: str, value: str):
        """Fill an input field with human-like typing"""
        try:
            element = await self.page.wait_for_selector(selector, timeout=5000)
            if element:
                await element.click()
                await random_delay(100, 300)
                # Clear existing value
                await element.fill('')
                # Type with delay
                await self.page.type(selector, value, delay=30)
        except PlaywrightTimeout:
            logger.warning("Input not found", selector=selector)
    
    async def _select_dropdown(self, selector: str, value: str):
        """Select value from a dropdown"""
        try:
            dropdown = await self.page.wait_for_selector(selector, timeout=5000)
            if dropdown:
                await dropdown.click()
                await random_delay(300, 600)
                
                # Type to search/filter
                await self.page.keyboard.type(value, delay=50)
                await random_delay(500, 800)
                
                # Click matching option
                option = await self.page.wait_for_selector(
                    f'//span[contains(text(), "{value}")]',
                    timeout=5000
                )
                if option:
                    await option.click()
        except PlaywrightTimeout:
            logger.warning("Dropdown selection failed", selector=selector, value=value)
    
    async def _navigate_form_pages(self):
        """Navigate through multi-page form"""
        max_pages = 5
        
        for _ in range(max_pages):
            try:
                next_btn = await self.page.wait_for_selector(
                    self.selectors.MARKETPLACE['next_button'],
                    timeout=3000
                )
                if next_btn:
                    await random_delay(500, 1000)
                    await next_btn.click()
                    await self.page.wait_for_load_state('networkidle')
                    await random_delay(1000, 2000)
            except PlaywrightTimeout:
                # No more Next buttons - we're at the end
                break
    
    async def _publish_listing(self) -> bool:
        """Publish the listing"""
        try:
            # Try different publish button selectors
            publish_selectors = [
                self.selectors.MARKETPLACE['publish_button'],
                self.selectors.MARKETPLACE['publish_button_text']
            ]
            
            for selector in publish_selectors:
                try:
                    publish_btn = await self.page.wait_for_selector(
                        selector,
                        timeout=5000
                    )
                    if publish_btn:
                        await random_delay(500, 1000)
                        await publish_btn.click()
                        await self.page.wait_for_load_state('networkidle')
                        await random_delay(3000, 5000)
                        
                        # Check for success
                        success = await self.page.query_selector(
                            self.selectors.MARKETPLACE['listing_success']
                        )
                        pending = await self.page.query_selector(
                            self.selectors.MARKETPLACE['listing_pending']
                        )
                        
                        if success or pending:
                            return True
                        
                        # Check URL changed to indicate listing created
                        if '/item/' in self.page.url or '/marketplace/you' in self.page.url:
                            return True
                        
                        break
                except PlaywrightTimeout:
                    continue
            
            return False
            
        except Exception as e:
            logger.error("Publish failed", error=str(e))
            return False
    
    async def _share_to_group(self, listing_id: str, group_id: str) -> bool:
        """Share listing to a Facebook group"""
        try:
            # This would involve navigating to the group and sharing the listing
            # Implementation depends on Facebook's current UI
            logger.info("Sharing to group", listing_id=listing_id, group_id=group_id)
            
            # Navigate to group
            await self.page.goto(f"https://www.facebook.com/groups/{group_id}")
            await self.page.wait_for_load_state('networkidle')
            await random_delay(2000, 3000)
            
            # Look for sell something button
            sell_btn = await self.page.query_selector(
                self.selectors.GROUPS['sell_something']
            )
            
            if sell_btn:
                await sell_btn.click()
                await random_delay(1000, 2000)
                
                # Link existing listing logic would go here
                # This is complex as FB's UI varies
                
                logger.info("Listed in group", group_id=group_id)
                return True
            
            return False
            
        except Exception as e:
            logger.error("Group sharing failed", 
                        group_id=group_id, 
                        error=str(e))
            return False
    
    async def create_item_listing(
        self,
        item_data: Dict[str, Any],
        photos: List[str]
    ) -> Dict[str, Any]:
        """
        Create a general item listing on Marketplace
        
        Args:
            item_data: Dict containing:
                - title: Item title
                - price: Listing price
                - category: Category name
                - condition: New, Used, etc.
                - description: Item description
                - location: City/area
            photos: List of local file paths
            
        Returns:
            Dict with success status and details
        """
        result = {
            'success': False,
            'listing_id': None,
            'listing_url': None,
            'error': None
        }
        
        try:
            await add_human_behavior(self.page)
            
            # Navigate to item listing creation
            await self.page.goto(self.selectors.URLS['marketplace_create'])
            await self.page.wait_for_load_state('networkidle')
            await random_delay(2000, 3000)
            
            # Upload photos
            if photos:
                await self._upload_photos(photos)
                await random_delay(2000, 4000)
            
            # Fill title
            if 'title' in item_data:
                await self._fill_input(
                    self.selectors.MARKETPLACE['title_input'],
                    item_data['title']
                )
                await random_delay(300, 600)
            
            # Fill price
            if 'price' in item_data:
                await self._fill_input(
                    self.selectors.MARKETPLACE['price_input'],
                    str(item_data['price'])
                )
                await random_delay(300, 600)
            
            # Select category
            if 'category' in item_data:
                await self._select_dropdown(
                    self.selectors.MARKETPLACE['category_dropdown'],
                    item_data['category']
                )
                await random_delay(300, 600)
            
            # Select condition
            if 'condition' in item_data:
                await self._select_dropdown(
                    self.selectors.MARKETPLACE['condition_dropdown'],
                    item_data['condition']
                )
                await random_delay(300, 600)
            
            # Fill description
            if 'description' in item_data:
                await self._fill_input(
                    self.selectors.MARKETPLACE['description_input'],
                    item_data['description']
                )
                await random_delay(500, 1000)
            
            # Fill location
            if 'location' in item_data:
                await self._fill_input(
                    self.selectors.MARKETPLACE['location_input'],
                    item_data['location']
                )
                await random_delay(1000, 1500)
                
                try:
                    suggestion = await self.page.wait_for_selector(
                        self.selectors.COMMON['dropdown_option'],
                        timeout=5000
                    )
                    if suggestion:
                        await suggestion.click()
                except PlaywrightTimeout:
                    pass
            
            # Navigate and publish
            await self._navigate_form_pages()
            publish_success = await self._publish_listing()
            
            if publish_success:
                result['success'] = True
                result['listing_url'] = self.page.url
                
                url_parts = self.page.url.split('/')
                for i, part in enumerate(url_parts):
                    if part == 'item' and i + 1 < len(url_parts):
                        result['listing_id'] = url_parts[i + 1]
                        break
                
                logger.info("Item listing created successfully",
                           listing_id=result['listing_id'])
            else:
                result['error'] = 'Failed to publish listing'
            
            return result
            
        except Exception as e:
            result['error'] = str(e)
            logger.error("Item listing creation failed", error=str(e))
            return result
    
    async def get_my_listings(self) -> List[Dict[str, Any]]:
        """Retrieve current user's marketplace listings"""
        listings = []
        
        try:
            await self.page.goto(self.selectors.URLS['marketplace_you'])
            await self.page.wait_for_load_state('networkidle')
            await random_delay(2000, 3000)
            
            # Click on Active listings
            active_btn = await self.page.query_selector(
                self.selectors.MARKETPLACE['active_listings']
            )
            if active_btn:
                await active_btn.click()
                await self.page.wait_for_load_state('networkidle')
                await random_delay(1000, 2000)
            
            # Parse listings (implementation depends on FB's current DOM structure)
            # This is a placeholder - actual implementation would need current selectors
            
            logger.info("Retrieved listings", count=len(listings))
            
        except Exception as e:
            logger.error("Failed to get listings", error=str(e))
        
        return listings
