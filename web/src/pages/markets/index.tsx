/**
 * State Market Pages - Dealers Face
 * SEO-optimized landing pages for auto dealers in all 50 US states + DC + PR
 */

import { Link, useParams } from 'react-router-dom';
import { SEO } from '../../components/SEO';
import {
  MapPin,
  Car,
  Users,
  TrendingUp,
  CheckCircle,
  Star,
  Building2,
  DollarSign,
  BarChart3,
  Shield,
} from 'lucide-react';

// =================================================================
// State Data Configuration
// =================================================================

export interface StateData {
  slug: string;
  name: string;
  abbreviation: string;
  capital: string;
  largestCity: string;
  population: string;
  registeredVehicles: string;
  dealerCount: string;
  averageCarPrice: string;
  topCities: string[];
  marketInsights: string[];
  localChallenges: string[];
  popularVehicles: string[];
}

export const US_STATES: StateData[] = [
  {
    slug: 'alabama',
    name: 'Alabama',
    abbreviation: 'AL',
    capital: 'Montgomery',
    largestCity: 'Birmingham',
    population: '5.1M',
    registeredVehicles: '4.8M',
    dealerCount: '850+',
    averageCarPrice: '$28,500',
    topCities: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa'],
    marketInsights: [
      'Strong truck and SUV market due to rural areas',
      'Growing Honda and Toyota manufacturing presence',
      'Military base populations create steady demand',
    ],
    localChallenges: [
      'Competing with large dealer groups',
      'Reaching rural buyers online',
      'Seasonal inventory fluctuations',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Honda Pilot', 'Toyota Tacoma'],
  },
  {
    slug: 'alaska',
    name: 'Alaska',
    abbreviation: 'AK',
    capital: 'Juneau',
    largestCity: 'Anchorage',
    population: '733K',
    registeredVehicles: '720K',
    dealerCount: '120+',
    averageCarPrice: '$32,000',
    topCities: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'],
    marketInsights: [
      'AWD and 4WD vehicles dominate the market',
      'Limited competition creates opportunities',
      'High demand for trucks and SUVs year-round',
    ],
    localChallenges: [
      'Geographic isolation limits inventory access',
      'Harsh weather affects vehicle conditions',
      'Shipping costs for inventory',
    ],
    popularVehicles: ['Subaru Outback', 'Toyota 4Runner', 'Ford F-250', 'Jeep Wrangler'],
  },
  {
    slug: 'arizona',
    name: 'Arizona',
    abbreviation: 'AZ',
    capital: 'Phoenix',
    largestCity: 'Phoenix',
    population: '7.4M',
    registeredVehicles: '6.2M',
    dealerCount: '1,200+',
    averageCarPrice: '$31,000',
    topCities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'],
    marketInsights: [
      'Rapidly growing population increases demand',
      'Snowbird season creates seasonal opportunities',
      'Electric vehicle adoption accelerating',
    ],
    localChallenges: [
      'Intense competition in Phoenix metro',
      'Heat-related vehicle damage concerns',
      'Reaching seasonal residents effectively',
    ],
    popularVehicles: ['Toyota Camry', 'Honda CR-V', 'Ford F-150', 'Tesla Model 3'],
  },
  {
    slug: 'arkansas',
    name: 'Arkansas',
    abbreviation: 'AR',
    capital: 'Little Rock',
    largestCity: 'Little Rock',
    population: '3.0M',
    registeredVehicles: '2.5M',
    dealerCount: '550+',
    averageCarPrice: '$26,500',
    topCities: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
    marketInsights: [
      'Strong used car market with value-conscious buyers',
      'Walmart headquarters drives regional economy',
      'Growing Northwest Arkansas market',
    ],
    localChallenges: [
      'Rural reach and connectivity',
      'Lower average income affects pricing',
      'Competition from neighboring states',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Tacoma', 'Honda Accord'],
  },
  {
    slug: 'california',
    name: 'California',
    abbreviation: 'CA',
    capital: 'Sacramento',
    largestCity: 'Los Angeles',
    population: '39.5M',
    registeredVehicles: '35M',
    dealerCount: '5,500+',
    averageCarPrice: '$38,000',
    topCities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno', 'Oakland'],
    marketInsights: [
      'Largest auto market in the United States',
      'Leading EV adoption rate nationally',
      'Diverse buyer demographics and preferences',
      'Strict emissions standards influence inventory',
    ],
    localChallenges: [
      'Extremely competitive market',
      'High cost of operations',
      'Complex regulations and compliance',
      'Wide geographic distribution',
    ],
    popularVehicles: ['Tesla Model Y', 'Toyota Prius', 'Honda Civic', 'Toyota RAV4', 'Tesla Model 3'],
  },
  {
    slug: 'colorado',
    name: 'Colorado',
    abbreviation: 'CO',
    capital: 'Denver',
    largestCity: 'Denver',
    population: '5.8M',
    registeredVehicles: '5.5M',
    dealerCount: '950+',
    averageCarPrice: '$35,000',
    topCities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder'],
    marketInsights: [
      'Outdoor lifestyle drives SUV and truck demand',
      'Growing tech sector increases buyer purchasing power',
      'AWD vehicles essential for mountain buyers',
    ],
    localChallenges: [
      'Seasonal inventory needs (ski season)',
      'High altitude affects vehicle performance marketing',
      'Competition from large dealer groups along I-25',
    ],
    popularVehicles: ['Subaru Outback', 'Toyota 4Runner', 'Jeep Grand Cherokee', 'Ford Bronco'],
  },
  {
    slug: 'connecticut',
    name: 'Connecticut',
    abbreviation: 'CT',
    capital: 'Hartford',
    largestCity: 'Bridgeport',
    population: '3.6M',
    registeredVehicles: '3.1M',
    dealerCount: '600+',
    averageCarPrice: '$34,000',
    topCities: ['Bridgeport', 'New Haven', 'Stamford', 'Hartford', 'Waterbury'],
    marketInsights: [
      'High income levels support premium vehicle sales',
      'Dense population allows targeted marketing',
      'Commuter market needs reliable vehicles',
    ],
    localChallenges: [
      'High property costs for dealerships',
      'Competition from NYC metro dealers',
      'Strict state regulations',
    ],
    popularVehicles: ['BMW 3 Series', 'Mercedes C-Class', 'Audi A4', 'Toyota RAV4'],
  },
  {
    slug: 'delaware',
    name: 'Delaware',
    abbreviation: 'DE',
    capital: 'Dover',
    largestCity: 'Wilmington',
    population: '1.0M',
    registeredVehicles: '850K',
    dealerCount: '180+',
    averageCarPrice: '$30,000',
    topCities: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Bear'],
    marketInsights: [
      'No sales tax attracts out-of-state buyers',
      'Corporate headquarters bring affluent buyers',
      'Beach community seasonal market',
    ],
    localChallenges: [
      'Small market size limits scale',
      'Competition from nearby states',
      'Seasonal fluctuations',
    ],
    popularVehicles: ['Toyota Camry', 'Honda Accord', 'Ford F-150', 'Jeep Cherokee'],
  },
  {
    slug: 'florida',
    name: 'Florida',
    abbreviation: 'FL',
    capital: 'Tallahassee',
    largestCity: 'Jacksonville',
    population: '22.2M',
    registeredVehicles: '18M',
    dealerCount: '4,200+',
    averageCarPrice: '$32,000',
    topCities: ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Fort Lauderdale'],
    marketInsights: [
      'Third largest auto market in the US',
      'Strong snowbird and retiree demographic',
      'Year-round selling season (no harsh winters)',
      'Growing population drives consistent demand',
    ],
    localChallenges: [
      'Hurricane season affects inventory',
      'High competition in major metros',
      'Diverse buyer demographics require varied inventory',
    ],
    popularVehicles: ['Toyota Camry', 'Honda Civic', 'Ford F-150', 'Nissan Altima', 'Chevrolet Equinox'],
  },
  {
    slug: 'georgia',
    name: 'Georgia',
    abbreviation: 'GA',
    capital: 'Atlanta',
    largestCity: 'Atlanta',
    population: '10.9M',
    registeredVehicles: '9.5M',
    dealerCount: '2,100+',
    averageCarPrice: '$31,500',
    topCities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Marietta'],
    marketInsights: [
      'Major auto manufacturing hub (Kia, Mercedes)',
      'Atlanta metro dominates state market',
      'Strong film industry brings temporary residents',
    ],
    localChallenges: [
      'Heavy competition in Atlanta area',
      'Long commute culture demands reliable vehicles',
      'Rural vs urban market differences',
    ],
    popularVehicles: ['Kia Telluride', 'Mercedes-Benz GLE', 'Ford F-150', 'Honda CR-V'],
  },
  {
    slug: 'hawaii',
    name: 'Hawaii',
    abbreviation: 'HI',
    capital: 'Honolulu',
    largestCity: 'Honolulu',
    population: '1.4M',
    registeredVehicles: '1.1M',
    dealerCount: '150+',
    averageCarPrice: '$35,000',
    topCities: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu'],
    marketInsights: [
      'Island geography limits vehicle choices',
      'High fuel costs drive efficiency demand',
      'Tourism industry creates rental car demand',
    ],
    localChallenges: [
      'Shipping costs for inventory',
      'Limited space for large inventory',
      'Island-specific vehicle preferences',
    ],
    popularVehicles: ['Toyota Tacoma', 'Honda Civic', 'Toyota Prius', 'Jeep Wrangler'],
  },
  {
    slug: 'idaho',
    name: 'Idaho',
    abbreviation: 'ID',
    capital: 'Boise',
    largestCity: 'Boise',
    population: '1.9M',
    registeredVehicles: '1.8M',
    dealerCount: '350+',
    averageCarPrice: '$29,500',
    topCities: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'],
    marketInsights: [
      'Fastest-growing state population',
      'Tech migration from California increases demand',
      'Outdoor recreation drives SUV sales',
    ],
    localChallenges: [
      'Rapid population growth strains inventory',
      'Rural distribution challenges',
      'Seasonal winter driving needs',
    ],
    popularVehicles: ['Ford F-150', 'Toyota Tacoma', 'Subaru Outback', 'Chevrolet Silverado'],
  },
  {
    slug: 'illinois',
    name: 'Illinois',
    abbreviation: 'IL',
    capital: 'Springfield',
    largestCity: 'Chicago',
    population: '12.6M',
    registeredVehicles: '10.2M',
    dealerCount: '2,800+',
    averageCarPrice: '$32,000',
    topCities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield'],
    marketInsights: [
      'Chicago metro is 3rd largest US auto market',
      'Strong union presence affects buying power',
      'Four seasons require versatile vehicles',
    ],
    localChallenges: [
      'Chicago parking and space limitations',
      'High insurance costs in urban areas',
      'Diverse ethnic markets with different preferences',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Equinox', 'Toyota RAV4', 'Honda CR-V'],
  },
  {
    slug: 'indiana',
    name: 'Indiana',
    abbreviation: 'IN',
    capital: 'Indianapolis',
    largestCity: 'Indianapolis',
    population: '6.8M',
    registeredVehicles: '6.1M',
    dealerCount: '1,400+',
    averageCarPrice: '$28,000',
    topCities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
    marketInsights: [
      'Auto racing culture influences vehicle preferences',
      'Strong manufacturing economy',
      'Indianapolis 500 drives performance car interest',
    ],
    localChallenges: [
      'Weather impacts seasonal sales',
      'Competition from larger neighboring markets',
      'Rural connectivity for online sales',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Camry', 'Honda Accord'],
  },
  {
    slug: 'iowa',
    name: 'Iowa',
    abbreviation: 'IA',
    capital: 'Des Moines',
    largestCity: 'Des Moines',
    population: '3.2M',
    registeredVehicles: '3.4M',
    dealerCount: '750+',
    averageCarPrice: '$27,500',
    topCities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'],
    marketInsights: [
      'More vehicles than people ratio',
      'Agricultural economy drives truck demand',
      'Strong community loyalty to local dealers',
    ],
    localChallenges: [
      'Spread out population',
      'Weather extremes affect inventory',
      'Limited digital adoption in rural areas',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'John Deere Gator'],
  },
  {
    slug: 'kansas',
    name: 'Kansas',
    abbreviation: 'KS',
    capital: 'Topeka',
    largestCity: 'Wichita',
    population: '2.9M',
    registeredVehicles: '2.6M',
    dealerCount: '600+',
    averageCarPrice: '$27,000',
    topCities: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'],
    marketInsights: [
      'Kansas City metro spans state lines',
      'Aviation industry provides stable employment',
      'Strong agricultural and rural market',
    ],
    localChallenges: [
      'Competition from Missouri dealers',
      'Wide geographic distribution',
      'Weather impacts (tornadoes, winters)',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Tundra', 'GMC Sierra'],
  },
  {
    slug: 'kentucky',
    name: 'Kentucky',
    abbreviation: 'KY',
    capital: 'Frankfort',
    largestCity: 'Louisville',
    population: '4.5M',
    registeredVehicles: '3.9M',
    dealerCount: '850+',
    averageCarPrice: '$27,500',
    topCities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'],
    marketInsights: [
      'Major Toyota and Ford manufacturing presence',
      'Bourbon tourism brings visitors',
      'Horse industry creates affluent market segment',
    ],
    localChallenges: [
      'Rural vs urban market split',
      'Appalachian region accessibility',
      'Border competition (Ohio, Indiana, Tennessee)',
    ],
    popularVehicles: ['Toyota Camry', 'Ford F-150', 'Chevrolet Corvette', 'Toyota Tundra'],
  },
  {
    slug: 'louisiana',
    name: 'Louisiana',
    abbreviation: 'LA',
    capital: 'Baton Rouge',
    largestCity: 'New Orleans',
    population: '4.6M',
    registeredVehicles: '4.1M',
    dealerCount: '900+',
    averageCarPrice: '$29,000',
    topCities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'],
    marketInsights: [
      'Oil and gas industry influences economy',
      'Hurricane-prone area affects vehicle demand',
      'Strong truck market for work vehicles',
    ],
    localChallenges: [
      'Hurricane season impacts sales and inventory',
      'Flood damage concerns for buyers',
      'Economic fluctuations tied to energy sector',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Tundra', 'Nissan Titan'],
  },
  {
    slug: 'maine',
    name: 'Maine',
    abbreviation: 'ME',
    capital: 'Augusta',
    largestCity: 'Portland',
    population: '1.4M',
    registeredVehicles: '1.2M',
    dealerCount: '280+',
    averageCarPrice: '$28,500',
    topCities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'],
    marketInsights: [
      'AWD/4WD essential for winter driving',
      'Tourism brings seasonal demand',
      'Aging population affects vehicle preferences',
    ],
    localChallenges: [
      'Harsh winters limit showing vehicles',
      'Rural distribution challenges',
      'Older demographic prefers traditional sales',
    ],
    popularVehicles: ['Subaru Outback', 'Toyota RAV4', 'Ford F-150', 'Honda CR-V'],
  },
  {
    slug: 'maryland',
    name: 'Maryland',
    abbreviation: 'MD',
    capital: 'Annapolis',
    largestCity: 'Baltimore',
    population: '6.2M',
    registeredVehicles: '5.0M',
    dealerCount: '1,100+',
    averageCarPrice: '$33,000',
    topCities: ['Baltimore', 'Columbia', 'Germantown', 'Silver Spring', 'Waldorf'],
    marketInsights: [
      'High income DC suburb market',
      'Government employees provide stable demand',
      'Dense population enables targeted marketing',
    ],
    localChallenges: [
      'Competition from DC and Virginia dealers',
      'Traffic congestion affects test drives',
      'High operating costs in metro areas',
    ],
    popularVehicles: ['Honda CR-V', 'Toyota RAV4', 'BMW 3 Series', 'Mercedes C-Class'],
  },
  {
    slug: 'massachusetts',
    name: 'Massachusetts',
    abbreviation: 'MA',
    capital: 'Boston',
    largestCity: 'Boston',
    population: '7.0M',
    registeredVehicles: '5.5M',
    dealerCount: '1,200+',
    averageCarPrice: '$35,000',
    topCities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'],
    marketInsights: [
      'High education levels drive informed buyers',
      'Tech industry creates affluent market',
      'Strong EV adoption in urban areas',
    ],
    localChallenges: [
      'Limited parking and space',
      'High cost of doing business',
      'Seasonal weather impacts',
    ],
    popularVehicles: ['Toyota RAV4', 'Honda CR-V', 'Subaru Outback', 'Tesla Model 3'],
  },
  {
    slug: 'michigan',
    name: 'Michigan',
    abbreviation: 'MI',
    capital: 'Lansing',
    largestCity: 'Detroit',
    population: '10.0M',
    registeredVehicles: '8.5M',
    dealerCount: '2,400+',
    averageCarPrice: '$30,000',
    topCities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor'],
    marketInsights: [
      'Automotive capital - strong brand loyalty',
      'Big 3 employee discounts affect market',
      'Strong truck and SUV culture',
    ],
    localChallenges: [
      'Heavy domestic brand preference',
      'Weather extremes affect sales cycles',
      'Economic ties to auto industry',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'Jeep Grand Cherokee'],
  },
  {
    slug: 'minnesota',
    name: 'Minnesota',
    abbreviation: 'MN',
    capital: 'Saint Paul',
    largestCity: 'Minneapolis',
    population: '5.7M',
    registeredVehicles: '5.2M',
    dealerCount: '1,100+',
    averageCarPrice: '$31,000',
    topCities: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington'],
    marketInsights: [
      'AWD vehicles essential for winters',
      'Strong economy and buying power',
      'Outdoor recreation drives SUV demand',
    ],
    localChallenges: [
      'Harsh winters limit showing seasons',
      'Rural distribution in northern regions',
      'Competition from large dealer groups',
    ],
    popularVehicles: ['Subaru Outback', 'Toyota RAV4', 'Ford F-150', 'Honda CR-V'],
  },
  {
    slug: 'mississippi',
    name: 'Mississippi',
    abbreviation: 'MS',
    capital: 'Jackson',
    largestCity: 'Jackson',
    population: '2.9M',
    registeredVehicles: '2.5M',
    dealerCount: '500+',
    averageCarPrice: '$25,500',
    topCities: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'],
    marketInsights: [
      'Value-conscious buyer market',
      'Strong used car demand',
      'Truck-heavy preferences for rural work',
    ],
    localChallenges: [
      'Lower average income affects pricing',
      'Rural distribution challenges',
      'Hurricane exposure on Gulf Coast',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Nissan Altima', 'Toyota Camry'],
  },
  {
    slug: 'missouri',
    name: 'Missouri',
    abbreviation: 'MO',
    capital: 'Jefferson City',
    largestCity: 'Kansas City',
    population: '6.2M',
    registeredVehicles: '5.5M',
    dealerCount: '1,300+',
    averageCarPrice: '$28,500',
    topCities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'],
    marketInsights: [
      'Two major metros offer diverse markets',
      'Central location attracts regional buyers',
      'Strong Ford and GM presence',
    ],
    localChallenges: [
      'Split market between KC and STL',
      'Weather variability (tornadoes)',
      'Competition from neighboring states',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Camry', 'Honda CR-V'],
  },
  {
    slug: 'montana',
    name: 'Montana',
    abbreviation: 'MT',
    capital: 'Helena',
    largestCity: 'Billings',
    population: '1.1M',
    registeredVehicles: '1.2M',
    dealerCount: '250+',
    averageCarPrice: '$30,000',
    topCities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'],
    marketInsights: [
      'More vehicles than people',
      'Outdoor lifestyle drives truck/SUV demand',
      'No sales tax attracts cross-border buyers',
    ],
    localChallenges: [
      'Vast distances between population centers',
      'Harsh winters limit inventory exposure',
      'Limited population base',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Tacoma', 'Subaru Outback'],
  },
  {
    slug: 'nebraska',
    name: 'Nebraska',
    abbreviation: 'NE',
    capital: 'Lincoln',
    largestCity: 'Omaha',
    population: '2.0M',
    registeredVehicles: '1.9M',
    dealerCount: '450+',
    averageCarPrice: '$28,000',
    topCities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'],
    marketInsights: [
      'Agricultural economy drives truck demand',
      'Omaha-Lincoln corridor concentrates demand',
      'Strong work ethic culture values reliable vehicles',
    ],
    localChallenges: [
      'Rural distribution across state',
      'Weather extremes',
      'Competition from larger Iowa market',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'Toyota Tacoma'],
  },
  {
    slug: 'nevada',
    name: 'Nevada',
    abbreviation: 'NV',
    capital: 'Carson City',
    largestCity: 'Las Vegas',
    population: '3.2M',
    registeredVehicles: '2.7M',
    dealerCount: '550+',
    averageCarPrice: '$32,000',
    topCities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'],
    marketInsights: [
      'Las Vegas dominates state market',
      'Tourism industry creates diverse demand',
      'Tesla Gigafactory boosting EV interest',
    ],
    localChallenges: [
      'Heat damage to vehicle inventory',
      'Tourism fluctuations affect local economy',
      'Reno/Vegas market split',
    ],
    popularVehicles: ['Toyota Camry', 'Honda Accord', 'Ford F-150', 'Tesla Model 3'],
  },
  {
    slug: 'new-hampshire',
    name: 'New Hampshire',
    abbreviation: 'NH',
    capital: 'Concord',
    largestCity: 'Manchester',
    population: '1.4M',
    registeredVehicles: '1.3M',
    dealerCount: '300+',
    averageCarPrice: '$31,000',
    topCities: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover'],
    marketInsights: [
      'No sales tax attracts Massachusetts buyers',
      'High income levels support premium purchases',
      'Outdoor recreation drives AWD demand',
    ],
    localChallenges: [
      'Competition from Massachusetts dealers',
      'Seasonal tourism fluctuations',
      'Winter weather impacts',
    ],
    popularVehicles: ['Subaru Outback', 'Toyota RAV4', 'Honda CR-V', 'Ford F-150'],
  },
  {
    slug: 'new-jersey',
    name: 'New Jersey',
    abbreviation: 'NJ',
    capital: 'Trenton',
    largestCity: 'Newark',
    population: '9.3M',
    registeredVehicles: '7.2M',
    dealerCount: '1,800+',
    averageCarPrice: '$34,000',
    topCities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison'],
    marketInsights: [
      'Dense population enables targeted marketing',
      'High income supports premium vehicle sales',
      'Strong commuter market to NYC',
    ],
    localChallenges: [
      'High operating costs',
      'Competition from NYC metro dealers',
      'Space constraints for dealerships',
    ],
    popularVehicles: ['Honda CR-V', 'Toyota RAV4', 'BMW 3 Series', 'Mercedes C-Class'],
  },
  {
    slug: 'new-mexico',
    name: 'New Mexico',
    abbreviation: 'NM',
    capital: 'Santa Fe',
    largestCity: 'Albuquerque',
    population: '2.1M',
    registeredVehicles: '1.8M',
    dealerCount: '350+',
    averageCarPrice: '$28,000',
    topCities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'],
    marketInsights: [
      'Albuquerque dominates state market',
      'Outdoor lifestyle drives SUV demand',
      'Border proximity creates unique opportunities',
    ],
    localChallenges: [
      'Spread out population',
      'Lower average income',
      'Limited metro areas',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Tacoma', 'Jeep Wrangler'],
  },
  {
    slug: 'new-york',
    name: 'New York',
    abbreviation: 'NY',
    capital: 'Albany',
    largestCity: 'New York City',
    population: '19.5M',
    registeredVehicles: '11.5M',
    dealerCount: '3,500+',
    averageCarPrice: '$36,000',
    topCities: ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
    marketInsights: [
      'NYC metro is largest US auto market',
      'Upstate NY has different needs than city',
      'Strong luxury vehicle market in metro',
    ],
    localChallenges: [
      'NYC has low car ownership rates',
      'High costs in metro areas',
      'Diverse market segments',
    ],
    popularVehicles: ['Honda CR-V', 'Toyota RAV4', 'BMW 3 Series', 'Mercedes-Benz GLC'],
  },
  {
    slug: 'north-carolina',
    name: 'North Carolina',
    abbreviation: 'NC',
    capital: 'Raleigh',
    largestCity: 'Charlotte',
    population: '10.7M',
    registeredVehicles: '9.2M',
    dealerCount: '2,200+',
    averageCarPrice: '$30,500',
    topCities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
    marketInsights: [
      'Rapidly growing population',
      'Research Triangle creates tech-savvy buyers',
      'Strong banking sector in Charlotte',
    ],
    localChallenges: [
      'Competition across multiple metros',
      'Hurricane exposure on coast',
      'Mountain vs coastal market differences',
    ],
    popularVehicles: ['Ford F-150', 'Toyota Camry', 'Honda CR-V', 'Chevrolet Silverado'],
  },
  {
    slug: 'north-dakota',
    name: 'North Dakota',
    abbreviation: 'ND',
    capital: 'Bismarck',
    largestCity: 'Fargo',
    population: '780K',
    registeredVehicles: '850K',
    dealerCount: '180+',
    averageCarPrice: '$29,000',
    topCities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'],
    marketInsights: [
      'Oil industry creates purchasing power',
      'More vehicles than people',
      'AWD essential for harsh winters',
    ],
    localChallenges: [
      'Small population base',
      'Extreme weather limits operations',
      'Geographic isolation',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'GMC Sierra'],
  },
  {
    slug: 'ohio',
    name: 'Ohio',
    abbreviation: 'OH',
    capital: 'Columbus',
    largestCity: 'Columbus',
    population: '11.8M',
    registeredVehicles: '10.1M',
    dealerCount: '2,600+',
    averageCarPrice: '$29,500',
    topCities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
    marketInsights: [
      'Honda manufacturing hub (Marysville)',
      'Multiple major metros spread demand',
      'Strong automotive heritage',
    ],
    localChallenges: [
      'Competition across multiple cities',
      'Weather impacts inventory',
      'Economic variability by region',
    ],
    popularVehicles: ['Honda Accord', 'Honda CR-V', 'Ford F-150', 'Chevrolet Equinox'],
  },
  {
    slug: 'oklahoma',
    name: 'Oklahoma',
    abbreviation: 'OK',
    capital: 'Oklahoma City',
    largestCity: 'Oklahoma City',
    population: '4.0M',
    registeredVehicles: '3.6M',
    dealerCount: '800+',
    averageCarPrice: '$28,000',
    topCities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Lawton'],
    marketInsights: [
      'Energy sector influences economy',
      'Strong truck market for work vehicles',
      'OKC and Tulsa dominate market',
    ],
    localChallenges: [
      'Oil price fluctuations affect economy',
      'Tornado risk impacts inventory',
      'Rural distribution challenges',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'Toyota Tundra'],
  },
  {
    slug: 'oregon',
    name: 'Oregon',
    abbreviation: 'OR',
    capital: 'Salem',
    largestCity: 'Portland',
    population: '4.2M',
    registeredVehicles: '3.8M',
    dealerCount: '700+',
    averageCarPrice: '$32,000',
    topCities: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro'],
    marketInsights: [
      'No sales tax attracts cross-border buyers',
      'Environmental consciousness drives EV adoption',
      'Outdoor lifestyle increases SUV demand',
    ],
    localChallenges: [
      'Portland traffic affects test drives',
      'Environmental regulations',
      'Competition from Washington dealers',
    ],
    popularVehicles: ['Subaru Outback', 'Toyota RAV4', 'Honda CR-V', 'Tesla Model 3'],
  },
  {
    slug: 'pennsylvania',
    name: 'Pennsylvania',
    abbreviation: 'PA',
    capital: 'Harrisburg',
    largestCity: 'Philadelphia',
    population: '13.0M',
    registeredVehicles: '10.5M',
    dealerCount: '2,800+',
    averageCarPrice: '$31,000',
    topCities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie', 'Harrisburg'],
    marketInsights: [
      'Two major metros with different characteristics',
      'Strong manufacturing heritage',
      'AWD important for winter driving',
    ],
    localChallenges: [
      'East-West state split in preferences',
      'Weather impacts sales cycles',
      'Older population in some regions',
    ],
    popularVehicles: ['Ford F-150', 'Honda CR-V', 'Toyota RAV4', 'Subaru Outback'],
  },
  {
    slug: 'rhode-island',
    name: 'Rhode Island',
    abbreviation: 'RI',
    capital: 'Providence',
    largestCity: 'Providence',
    population: '1.1M',
    registeredVehicles: '850K',
    dealerCount: '200+',
    averageCarPrice: '$30,500',
    topCities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'],
    marketInsights: [
      'Dense population enables targeted marketing',
      'High income levels',
      'Coastal lifestyle creates specific needs',
    ],
    localChallenges: [
      'Small market size',
      'Competition from Massachusetts',
      'Limited inventory space',
    ],
    popularVehicles: ['Honda CR-V', 'Toyota RAV4', 'Subaru Outback', 'Ford F-150'],
  },
  {
    slug: 'south-carolina',
    name: 'South Carolina',
    abbreviation: 'SC',
    capital: 'Columbia',
    largestCity: 'Charleston',
    population: '5.2M',
    registeredVehicles: '4.5M',
    dealerCount: '950+',
    averageCarPrice: '$29,000',
    topCities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Greenville'],
    marketInsights: [
      'BMW and Mercedes manufacturing presence',
      'Growing population from migration',
      'Tourism creates seasonal opportunities',
    ],
    localChallenges: [
      'Hurricane exposure on coast',
      'Multiple competing metros',
      'Seasonal fluctuations',
    ],
    popularVehicles: ['BMW X3', 'Mercedes-Benz GLC', 'Ford F-150', 'Toyota Camry'],
  },
  {
    slug: 'south-dakota',
    name: 'South Dakota',
    abbreviation: 'SD',
    capital: 'Pierre',
    largestCity: 'Sioux Falls',
    population: '900K',
    registeredVehicles: '950K',
    dealerCount: '200+',
    averageCarPrice: '$28,500',
    topCities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'],
    marketInsights: [
      'No state income tax attracts retirees',
      'Tourism (Mount Rushmore) creates demand',
      'Agriculture drives truck market',
    ],
    localChallenges: [
      'Small population base',
      'Extreme weather',
      'Rural distribution challenges',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'Toyota Tundra'],
  },
  {
    slug: 'tennessee',
    name: 'Tennessee',
    abbreviation: 'TN',
    capital: 'Nashville',
    largestCity: 'Nashville',
    population: '7.0M',
    registeredVehicles: '6.2M',
    dealerCount: '1,400+',
    averageCarPrice: '$29,500',
    topCities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
    marketInsights: [
      'Nissan and GM manufacturing presence',
      'Nashville boom driving population growth',
      'No state income tax increases buying power',
    ],
    localChallenges: [
      'Multiple competing metros',
      'Rapid growth strains inventory',
      'Tornado risk in region',
    ],
    popularVehicles: ['Nissan Altima', 'Ford F-150', 'Toyota Camry', 'Chevrolet Silverado'],
  },
  {
    slug: 'texas',
    name: 'Texas',
    abbreviation: 'TX',
    capital: 'Austin',
    largestCity: 'Houston',
    population: '30.0M',
    registeredVehicles: '24M',
    dealerCount: '6,500+',
    averageCarPrice: '$34,000',
    topCities: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
    marketInsights: [
      'Second largest auto market in US',
      'Strong truck culture statewide',
      'Tesla HQ in Austin driving EV interest',
      'Oil industry creates high purchasing power',
    ],
    localChallenges: [
      'Vast geographic distribution',
      'Intense competition in major metros',
      'Extreme heat affects inventory',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'Toyota Tundra', 'Tesla Model Y'],
  },
  {
    slug: 'utah',
    name: 'Utah',
    abbreviation: 'UT',
    capital: 'Salt Lake City',
    largestCity: 'Salt Lake City',
    population: '3.4M',
    registeredVehicles: '2.9M',
    dealerCount: '550+',
    averageCarPrice: '$32,000',
    topCities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'],
    marketInsights: [
      'Youngest state population (families)',
      'Outdoor recreation drives SUV demand',
      'Tech corridor creates affluent buyers',
    ],
    localChallenges: [
      'Air quality concerns affect EV interest',
      'Religious community influences buying',
      'Winter weather impacts',
    ],
    popularVehicles: ['Toyota 4Runner', 'Subaru Outback', 'Honda Pilot', 'Ford F-150'],
  },
  {
    slug: 'vermont',
    name: 'Vermont',
    abbreviation: 'VT',
    capital: 'Montpelier',
    largestCity: 'Burlington',
    population: '650K',
    registeredVehicles: '600K',
    dealerCount: '140+',
    averageCarPrice: '$29,500',
    topCities: ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier'],
    marketInsights: [
      'Environmental consciousness high',
      'AWD essential for winters',
      'Tourism creates seasonal opportunities',
    ],
    localChallenges: [
      'Smallest market in Northeast',
      'Harsh winters limit operations',
      'Rural distribution',
    ],
    popularVehicles: ['Subaru Outback', 'Toyota RAV4', 'Honda CR-V', 'Subaru Forester'],
  },
  {
    slug: 'virginia',
    name: 'Virginia',
    abbreviation: 'VA',
    capital: 'Richmond',
    largestCity: 'Virginia Beach',
    population: '8.6M',
    registeredVehicles: '7.2M',
    dealerCount: '1,600+',
    averageCarPrice: '$33,000',
    topCities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria'],
    marketInsights: [
      'DC suburbs drive high-income market',
      'Military presence creates steady demand',
      'Government workers provide stable buyers',
    ],
    localChallenges: [
      'Competition from DC and Maryland',
      'Diverse markets across state',
      'Hampton Roads vs Northern VA differences',
    ],
    popularVehicles: ['Honda CR-V', 'Toyota RAV4', 'Ford F-150', 'BMW X5'],
  },
  {
    slug: 'washington',
    name: 'Washington',
    abbreviation: 'WA',
    capital: 'Olympia',
    largestCity: 'Seattle',
    population: '7.7M',
    registeredVehicles: '6.5M',
    dealerCount: '1,200+',
    averageCarPrice: '$35,000',
    topCities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent'],
    marketInsights: [
      'Tech industry (Amazon, Microsoft) drives luxury',
      'Environmental consciousness high',
      'EV adoption among highest in nation',
    ],
    localChallenges: [
      'Seattle congestion affects operations',
      'High cost of business',
      'West vs East state differences',
    ],
    popularVehicles: ['Tesla Model 3', 'Toyota RAV4', 'Subaru Outback', 'Honda CR-V'],
  },
  {
    slug: 'west-virginia',
    name: 'West Virginia',
    abbreviation: 'WV',
    capital: 'Charleston',
    largestCity: 'Charleston',
    population: '1.8M',
    registeredVehicles: '1.5M',
    dealerCount: '350+',
    averageCarPrice: '$26,000',
    topCities: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'],
    marketInsights: [
      'Mountain terrain requires AWD/4WD',
      'Value-conscious buyer base',
      'Strong used car market',
    ],
    localChallenges: [
      'Lower average income',
      'Mountainous terrain distribution challenges',
      'Population decline in some areas',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'Toyota Tacoma', 'Jeep Wrangler'],
  },
  {
    slug: 'wisconsin',
    name: 'Wisconsin',
    abbreviation: 'WI',
    capital: 'Madison',
    largestCity: 'Milwaukee',
    population: '5.9M',
    registeredVehicles: '5.4M',
    dealerCount: '1,200+',
    averageCarPrice: '$29,500',
    topCities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'],
    marketInsights: [
      'AWD essential for harsh winters',
      'Strong manufacturing economy',
      'Outdoor recreation drives SUV demand',
    ],
    localChallenges: [
      'Severe winters limit showing season',
      'Chicago competition on border',
      'Rural distribution in north',
    ],
    popularVehicles: ['Subaru Outback', 'Ford F-150', 'Chevrolet Equinox', 'Toyota RAV4'],
  },
  {
    slug: 'wyoming',
    name: 'Wyoming',
    abbreviation: 'WY',
    capital: 'Cheyenne',
    largestCity: 'Cheyenne',
    population: '580K',
    registeredVehicles: '650K',
    dealerCount: '130+',
    averageCarPrice: '$30,000',
    topCities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'],
    marketInsights: [
      'More vehicles than people',
      'No state income tax',
      'Energy industry creates purchasing power',
    ],
    localChallenges: [
      'Smallest state population',
      'Vast distances between towns',
      'Extreme weather conditions',
    ],
    popularVehicles: ['Ford F-150', 'Chevrolet Silverado', 'RAM 1500', 'Toyota Tundra'],
  },
  {
    slug: 'washington-dc',
    name: 'Washington D.C.',
    abbreviation: 'DC',
    capital: 'Washington',
    largestCity: 'Washington',
    population: '690K',
    registeredVehicles: '320K',
    dealerCount: '80+',
    averageCarPrice: '$38,000',
    topCities: ['Downtown', 'Georgetown', 'Capitol Hill', 'Dupont Circle', 'Adams Morgan'],
    marketInsights: [
      'Highest income metro in US',
      'Government and lobbying industry',
      'Strong luxury and EV market',
    ],
    localChallenges: [
      'Low car ownership in city proper',
      'Competition from VA and MD suburbs',
      'Limited space for dealerships',
    ],
    popularVehicles: ['Tesla Model 3', 'BMW 3 Series', 'Mercedes C-Class', 'Audi A4'],
  },
  {
    slug: 'puerto-rico',
    name: 'Puerto Rico',
    abbreviation: 'PR',
    capital: 'San Juan',
    largestCity: 'San Juan',
    population: '3.2M',
    registeredVehicles: '2.5M',
    dealerCount: '400+',
    averageCarPrice: '$28,000',
    topCities: ['San Juan', 'Bayamón', 'Carolina', 'Ponce', 'Caguas'],
    marketInsights: [
      'Compact vehicles preferred for narrow roads',
      'High import duties affect pricing',
      'Tropical climate - no winter wear',
    ],
    localChallenges: [
      'Hurricane damage concerns',
      'Economic challenges',
      'Import logistics',
    ],
    popularVehicles: ['Toyota Corolla', 'Honda Civic', 'Hyundai Elantra', 'Nissan Sentra'],
  },
];

// Get state by slug
export function getStateBySlug(slug: string): StateData | undefined {
  return US_STATES.find(state => state.slug === slug);
}

// =================================================================
// State Market Page Component
// =================================================================

export function StateMarketPage() {
  const { stateSlug } = useParams<{ stateSlug: string }>();
  const state = getStateBySlug(stateSlug || '');

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">State Not Found</h1>
          <Link to="/markets" className="text-blue-600 hover:underline">
            View All Markets →
          </Link>
        </div>
      </div>
    );
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Dealers Face - ${state.name} Auto Dealer Solutions`,
    description: `Facebook Marketplace automation for auto dealers in ${state.name}. Post your entire inventory, capture leads, and sell more cars to ${state.population} potential buyers.`,
    url: `https://dealersface.com/markets/${state.slug}`,
    areaServed: {
      '@type': 'State',
      name: state.name,
      containedInPlace: {
        '@type': 'Country',
        name: 'United States',
      },
    },
    provider: {
      '@type': 'Organization',
      name: 'Dealers Face',
      url: 'https://dealersface.com',
    },
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Dealers Face',
    description: `Auto dealer Facebook Marketplace solutions in ${state.name}`,
    url: `https://dealersface.com/markets/${state.slug}`,
    areaServed: state.topCities.map(city => ({
      '@type': 'City',
      name: city,
      containedInPlace: {
        '@type': 'State',
        name: state.name,
      },
    })),
  };

  return (
    <>
      <SEO
        title={`${state.name} Auto Dealer Facebook Marketplace Software`}
        description={`#1 Facebook Marketplace automation for ${state.name} auto dealers. Reach ${state.population} potential buyers, post unlimited inventory, capture leads. Used by ${state.dealerCount} dealers.`}
        canonicalUrl={`https://dealersface.com/markets/${state.slug}`}
        geoRegion={`US-${state.abbreviation}`}
        geoPlacename={state.name}
        schema={[schema, localBusinessSchema]}
        keywords={`${state.name} auto dealer, ${state.name} car dealership, Facebook Marketplace ${state.name}, car dealer software ${state.abbreviation}`}
      />

      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">DF</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  Dealers <span className="text-blue-600">Face</span>
                </span>
              </Link>
              
              <div className="hidden md:flex items-center space-x-8">
                <Link to="/features" className="text-gray-600 hover:text-blue-600">Features</Link>
                <Link to="/pricing" className="text-gray-600 hover:text-blue-600">Pricing</Link>
                <Link to="/markets" className="text-gray-600 hover:text-blue-600">Markets</Link>
                <Link to="/login" className="text-gray-600 hover:text-blue-600">Sign In</Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-24 pb-16 bg-gradient-to-b from-blue-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
                <MapPin className="w-4 h-4 mr-2" />
                Serving {state.name} Auto Dealers
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6">
                Facebook Marketplace for{' '}
                <span className="text-blue-600">{state.name}</span> Dealers
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Join {state.dealerCount} {state.name} dealerships already using Dealers Face 
                to reach {state.population} potential car buyers on Facebook Marketplace.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/register"
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg"
                >
                  Start Free 14-Day Trial
                </Link>
                <Link
                  to="/contact"
                  className="px-8 py-4 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:border-blue-600"
                >
                  Schedule Demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* State Stats */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Users, value: state.population, label: 'Population' },
                { icon: Car, value: state.registeredVehicles, label: 'Registered Vehicles' },
                { icon: Building2, value: state.dealerCount, label: 'Auto Dealers' },
                { icon: DollarSign, value: state.averageCarPrice, label: 'Avg. Car Price' },
              ].map((stat, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-6 text-center">
                  <stat.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                  <div className="text-3xl font-extrabold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Markets We Serve */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">
              {state.name} Markets We Serve
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {state.topCities.map((city, index) => (
                <div key={index} className="bg-white rounded-lg p-4 text-center shadow-sm">
                  <MapPin className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                  <span className="font-medium text-gray-900">{city}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Market Insights */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-6">
                  {state.name} Market Insights
                </h2>
                <div className="space-y-4">
                  {state.marketInsights.map((insight, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                      <span className="text-gray-700">{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-6">
                  Challenges We Solve
                </h2>
                <div className="space-y-4">
                  {state.localChallenges.map((challenge, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />
                      <span className="text-gray-700">{challenge}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Popular Vehicles */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">
              Top Selling Vehicles in {state.name}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {state.popularVehicles.map((vehicle, index) => (
                <div key={index} className="bg-white px-6 py-3 rounded-full shadow-sm">
                  <span className="font-medium text-gray-900">{vehicle}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features for State */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-12 text-center">
              Why {state.name} Dealers Choose Us
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Car,
                  title: 'Unlimited Vehicle Posts',
                  description: `Post your entire inventory to Facebook Marketplace. Reach ${state.name} buyers wherever they are.`,
                },
                {
                  icon: Users,
                  title: 'Local Lead Capture',
                  description: `Every inquiry from ${state.name} buyers flows directly to your CRM via industry-standard ADF format.`,
                },
                {
                  icon: BarChart3,
                  title: 'Market Analytics',
                  description: `Track which vehicles perform best in ${state.name} markets. Make data-driven inventory decisions.`,
                },
              ].map((feature, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-8">
                  <feature.icon className="w-10 h-10 text-blue-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="py-16 bg-blue-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
              ))}
            </div>
            <blockquote className="text-2xl text-white mb-6">
              "Dealers Face transformed our {state.name} dealership. We went from posting 
              vehicles manually to reaching thousands of local buyers automatically. 
              Our lead volume increased 45% in the first month."
            </blockquote>
            <cite className="text-blue-200">
              — {state.largestCity} Auto Dealer
            </cite>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-6">
              Ready to Dominate {state.name} Facebook Marketplace?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join {state.dealerCount} {state.name} dealerships already using Dealers Face. 
              Start your free 14-day trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              >
                Start Free Trial
              </Link>
              <Link
                to="/pricing"
                className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white/10"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">DF</span>
                </div>
                <span className="text-xl font-bold text-white">Dealers Face</span>
              </div>
              <p className="text-sm mb-4">
                The #1 Facebook Marketplace automation for auto dealers in {state.name} and nationwide.
              </p>
              <div className="flex justify-center gap-4 text-sm">
                <Link to="/privacy" className="hover:text-white">Privacy</Link>
                <Link to="/terms" className="hover:text-white">Terms</Link>
                <Link to="/contact" className="hover:text-white">Contact</Link>
              </div>
              <div className="mt-8 text-sm">
                © {new Date().getFullYear()} Dealers Face. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

// =================================================================
// Markets Index Page
// =================================================================

export function MarketsIndexPage() {
  const regions = {
    'Northeast': US_STATES.filter(s => ['CT', 'DE', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT', 'DC'].includes(s.abbreviation)),
    'Southeast': US_STATES.filter(s => ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV', 'PR'].includes(s.abbreviation)),
    'Midwest': US_STATES.filter(s => ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'].includes(s.abbreviation)),
    'Southwest': US_STATES.filter(s => ['AZ', 'NM', 'OK', 'TX'].includes(s.abbreviation)),
    'West': US_STATES.filter(s => ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'].includes(s.abbreviation)),
    'South': US_STATES.filter(s => ['AR', 'LA'].includes(s.abbreviation)),
  };

  return (
    <>
      <SEO
        title="Auto Dealer Markets | All 50 States"
        description="Dealers Face serves auto dealers in all 50 US states. Find Facebook Marketplace solutions for your local market. California, Texas, Florida, and more."
        canonicalUrl="https://dealersface.com/markets"
        keywords="auto dealer markets, car dealership software USA, Facebook Marketplace dealer, automotive marketing all states"
      />

      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">DF</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  Dealers <span className="text-blue-600">Face</span>
                </span>
              </Link>
              
              <div className="hidden md:flex items-center space-x-8">
                <Link to="/features" className="text-gray-600 hover:text-blue-600">Features</Link>
                <Link to="/pricing" className="text-gray-600 hover:text-blue-600">Pricing</Link>
                <Link to="/markets" className="text-blue-600 font-semibold">Markets</Link>
                <Link to="/login" className="text-gray-600 hover:text-blue-600">Sign In</Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-24 pb-16 bg-gradient-to-b from-blue-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              Serving Auto Dealers in{' '}
              <span className="text-blue-600">All 50 States</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              From California to New York, Texas to Florida, Dealers Face helps thousands 
              of dealerships sell more cars on Facebook Marketplace.
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                52 Markets Covered
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                15,000+ Active Dealers
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Local Support Teams
              </div>
            </div>
          </div>
        </section>

        {/* States by Region */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {Object.entries(regions).map(([region, states]) => (
              <div key={region} className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{region}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {states.map((state) => (
                    <Link
                      key={state.slug}
                      to={`/markets/${state.slug}`}
                      className="bg-gray-50 hover:bg-blue-50 rounded-lg p-4 text-center transition-colors group"
                    >
                      <div className="text-2xl font-bold text-gray-400 group-hover:text-blue-600 mb-1">
                        {state.abbreviation}
                      </div>
                      <div className="text-sm font-medium text-gray-900">{state.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{state.dealerCount} dealers</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-blue-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-white mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Join dealers across America who are selling more cars with Dealers Face.
            </p>
            <Link
              to="/register"
              className="inline-block px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-gray-100"
            >
              Start Your Free Trial
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm">
              © {new Date().getFullYear()} Dealers Face. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
