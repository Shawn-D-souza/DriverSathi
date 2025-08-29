# **DriverSathi: Real-Time Location Tracking App**

## **Project Overview**

DriverSathi is a mobile application built with Expo that enables real-time geographic location tracking for drivers. The app is designed to periodically send location data to a Supabase backend, even when running in the background.

### **Core Technologies**

* **Frontend:** React Native (Expo)  
* **Backend:** Supabase  
* **Authentication:** Supabase Auth

## **Minimum Viable Product (MVP) Features**

* **User Authentication:** Simple sign-in functionality for a single driver.  
* **Location Permissions:** Professional handling of user permissions for location access.  
* **Real-Time Tracking:** Captures the driver's latitude and longitude at set intervals once tracking is enabled.  
* **Background Updates:** Sends location updates to the backend, even when the app is not in the foreground.

## **Prerequisites**

* Node.js and npm (or yarn) installed  
* Expo CLI installed (npm install \-g expo-cli)  
* A Supabase project set up

## **Getting Started**

1. **Clone the repository:**  
   git clone https://github.com/your-username/DriverSathi.git

2. **Install dependencies:**  
   npm install

3. **Configure Supabase:**  
   * Create a .env file in the root of the project.  
   * Add your Supabase URL and anon key to the .env file:  
     EXPO\_PUBLIC\_SUPABASE\_URL=YOUR\_SUPABASE\_URL  
     EXPO\_PUBLIC\_SUPABASE\_ANON\_KEY=YOUR\_SUPABASE\_ANON\_KEY

4. **Start the development server:**  
   npx expo start

## **Project Structure**

.  
├── app/              \# Main application code  
├── assets/           \# Images, fonts, and other static assets  
├── components/       \# Reusable components  
├── constants/        \# App-wide constants  
├── scripts/          \# Utility scripts  
└── app.json          \# Expo configuration

## **License**

This project is proprietary and not open-source. All rights are reserved.