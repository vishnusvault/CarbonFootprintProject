export const ACTIVITY_DISPLAY_NAMES: Record<string, string> = {
  // Transport
  car_petrol: "Petrol Car",
  car_diesel: "Diesel Car",
  car_ev: "Electric Car",
  flight_short: "Short Flight",
  flight_long: "Long Flight",
  bus: "Bus",
  metro: "Metro",
  train: "Train",
  cycling: "Cycling",
  walking: "Walking",
  
  // Energy
  electricity_IN: "Electricity (India)",
  lpg: "LPG / Gas",
  generator: "Generator",
  
  // Food
  food_apples: "Apples",
  food_bananas: "Bananas",
  drink_beer: "Beer",
  food_biryani: "Biryani",
  food_cheese: "Cheese",
  food_chicken: "Chicken",
  drink_coffee: "Coffee",
  food_dal_makhani: "Dal Makhani",
  food_dosa: "Dosa",
  food_eggs: "Eggs",
  food_fish: "Fish",
  food_lamb: "Lamb",
  food_lentils: "Lentils/Beans",
  drink_milk: "Milk",
  food_paneer_tikka: "Paneer Tikka",
  food_pork: "Pork",
  food_potatoes: "Potatoes",
  food_rice: "Rice",
  food_samosa: "Samosa",
  drink_cola: "Soft Drink (Cola)",
  drink_tea: "Tea",
  food_tofu: "Tofu/Soy",
  food_tomatoes: "Tomatoes",
  food_wheat: "Wheat/Bread",

  // Purchase
  electronics_small: "Electronics (Small)",
  electronics_large: "Electronics (Large)",
  clothing: "Clothing",
};

export function getDisplayName(activityType: string): string {
  return ACTIVITY_DISPLAY_NAMES[activityType] 
    ?? activityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
