
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MapPin, ArrowLeft, Car, Navigation } from "lucide-react";
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { calculateRoute, RouteResult } from "@/utils/hereRouting";
import { MapComponent } from "@/components/map/MapComponent";

const HabiRide = () => {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showOrderStatus, setShowOrderStatus] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteResult['data'] | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  
  const { currentUser } = useAuth();
  
  // Listen for user's active orders
  useEffect(() => {
    if (!currentUser) return;
    
    const userId = currentUser.uid;
    const ordersRef = collection(db, "orders");
    const activeOrdersQuery = query(
      ordersRef,
      where("userId", "==", userId),
      where("status", "in", ["pending", "accepted", "on_the_way"])
    );
    
    const unsubscribe = onSnapshot(activeOrdersQuery, (snapshot) => {
      if (!snapshot.empty) {
        const orderData = snapshot.docs[0].data();
        const orderId = snapshot.docs[0].id;
        setActiveOrder({ id: orderId, ...orderData });
        setShowOrderStatus(true);
        
        // If order has a driver assigned, listen for driver location
        if (orderData.driverId) {
          listenToDriverLocation(orderData.driverId);
        }
      } else {
        setActiveOrder(null);
        setShowOrderStatus(false);
        setDriverLocation(null);
        setRouteInfo(null);
      }
    }, (error) => {
      console.error("Error fetching active orders:", error);
      toast({
        title: "Error",
        description: "Failed to fetch your active orders",
        variant: "destructive",
      });
    });
    
    return () => unsubscribe();
  }, [currentUser]);
  
  // Function to listen for driver location updates
  const listenToDriverLocation = (driverId: string) => {
    const driverLocationRef = doc(db, "driver_locations", driverId);
    
    return onSnapshot(driverLocationRef, (snapshot) => {
      if (snapshot.exists()) {
        const locationData = snapshot.data();
        setDriverLocation({
          lat: locationData.lat,
          lng: locationData.lng
        });
      }
    }, (error) => {
      console.error("Error fetching driver location:", error);
    });
  };
  
  // Function to cancel order
  const cancelOrder = async () => {
    if (!activeOrder) return;
    
    try {
      setLoading(true);
      await deleteDoc(doc(db, "orders", activeOrder.id));
      toast({
        title: "Order cancelled",
        description: "Your ride order has been cancelled successfully",
      });
      setActiveOrder(null);
      setShowOrderStatus(false);
      setRouteInfo(null);
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast({
        title: "Failed to cancel order",
        description: "There was an error cancelling your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to calculate route between pickup and destination
  const handleCalculateRoute = async () => {
    if (!pickup || !destination) {
      toast({
        title: "Missing locations",
        description: "Please enter both pickup and destination addresses",
        variant: "destructive",
      });
      return;
    }

    setCalculatingRoute(true);
    
    try {
      // In a real app, we'd use geocoding to convert addresses to coordinates
      // For this example, we'll use dummy coordinates around Jakarta
      const pickupLocation = {
        lat: -6.2088 + (Math.random() - 0.5) * 0.1,
        lng: 106.8456 + (Math.random() - 0.5) * 0.1
      };
      
      const destinationLocation = {
        lat: -6.2088 + (Math.random() - 0.5) * 0.1,
        lng: 106.8456 + (Math.random() - 0.5) * 0.1
      };

      console.log('Calculating route from:', pickupLocation, 'to:', destinationLocation);
      
      const routeResult = await calculateRoute(pickupLocation, destinationLocation);
      
      if (routeResult.success && routeResult.data) {
        setRouteInfo(routeResult.data);
        toast({
          title: "Route calculated",
          description: `Distance: ${routeResult.data.distanceText}, Duration: ${routeResult.data.durationText}`,
        });
      } else {
        toast({
          title: "Route calculation failed",
          description: routeResult.error || "Could not calculate route between locations",
          variant: "destructive",
        });
        setRouteInfo(null);
      }
    } catch (error) {
      console.error("Error calculating route:", error);
      toast({
        title: "Error",
        description: "Failed to calculate route. Please try again.",
        variant: "destructive",
      });
      setRouteInfo(null);
    } finally {
      setCalculatingRoute(false);
    }
  };
  
  // Function to book a ride
  const bookRide = async () => {
    if (!pickup || !destination) return;
    
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to book a ride",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // In a real app, we'd use a geocoding API to convert addresses to coordinates
      // For this example, we'll use dummy coordinates
      const pickupLocation = {
        lat: -6.2088 + (Math.random() - 0.5) * 0.1,
        lng: 106.8456 + (Math.random() - 0.5) * 0.1
      };
      
      const destinationLocation = {
        lat: -6.2088 + (Math.random() - 0.5) * 0.1,
        lng: 106.8456 + (Math.random() - 0.5) * 0.1
      };
      
      // Create new order in Firestore
      await addDoc(collection(db, "orders"), {
        userId: currentUser.uid,
        driverId: null,
        status: "pending",
        pickupLocation,
        destination: destinationLocation,
        pickupAddress: pickup,
        destinationAddress: destination,
        routeInfo: routeInfo, // Save route info with the order
        createdAt: serverTimestamp(),
      });
      
      toast({
        title: "Ride Requested",
        description: "Your ride request has been submitted successfully!",
      });
      
      // Reset form
      setPickup("");
      setDestination("");
      setRouteInfo(null);
      
    } catch (error) {
      console.error("Error booking ride:", error);
      toast({
        title: "Error",
        description: "Failed to book your ride. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to display status in a user-friendly way
  const formatStatus = (status: string) => {
    switch (status) {
      case "pending":
        return "Searching for driver...";
      case "accepted":
        return "Driver accepted your ride";
      case "on_the_way":
        return "Driver is on the way";
      case "done":
        return "Ride completed";
      default:
        return "Unknown status";
    }
  };
  
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-habisin-dark px-4 py-4 flex justify-between items-center rounded-b-3xl">
        <div className="flex items-center">
          <Link to="/" className="mr-3">
            <ArrowLeft className="h-6 w-6 text-white" />
          </Link>
          <h1 className="text-white text-2xl font-semibold">HabiRide</h1>
        </div>
        <div className="bg-white p-2 rounded-full">
          <Car className="text-habisin-dark w-6 h-6" />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Book a Ride</h2>
        <p className="text-gray-700 mb-6">Select your route details</p>
        
        {/* Form area */}
        <div className="mb-8">
          {/* Set pickup location */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex items-center px-4 py-4">
              <div className="w-6 mr-3 flex justify-center">
                <div className="w-3 h-3 bg-habisin-dark rounded-full"></div>
              </div>
              <input
                type="text"
                placeholder="Set pickup location"
                className="flex-1 outline-none text-gray-800"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
              />
            </div>
          </div>
          
          {/* Set destination */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex items-center px-4 py-4">
              <div className="w-6 mr-3 flex justify-center">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <input
                type="text"
                placeholder="Set destination"
                className="flex-1 outline-none text-gray-800"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
          </div>

          {/* Calculate Route Button */}
          <button
            className="bg-blue-600 text-white w-full py-3 rounded-xl font-medium mb-4 flex items-center justify-center"
            disabled={!pickup || !destination || calculatingRoute || activeOrder !== null}
            onClick={handleCalculateRoute}
          >
            <Navigation className="h-5 w-5 mr-2" />
            {calculatingRoute ? "Calculating Route..." : "Calculate Route"}
          </button>

          {/* Route Info Display */}
          {routeInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">Route Information</h3>
              <div className="flex justify-between text-sm text-blue-700">
                <span>Distance: {routeInfo.distanceText}</span>
                <span>Duration: {routeInfo.durationText}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Map area */}
        <div className="h-[40vh] bg-gray-100 rounded-xl mb-8 relative">
          {activeOrder?.driverId ? (
            <MapComponent 
              driverLocation={driverLocation}
              showDriverLocation={!!driverLocation}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="h-16 w-16 bg-habisin-dark rounded-full flex items-center justify-center">
                <MapPin className="h-8 w-8 text-white" />
              </div>
            </div>
          )}
          
          {/* Display driver location info if available */}
          {driverLocation && (
            <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-md">
              <p className="text-xs font-medium">Driver location:</p>
              <p className="text-xs">Lat: {driverLocation.lat.toFixed(4)}</p>
              <p className="text-xs">Lng: {driverLocation.lng.toFixed(4)}</p>
            </div>
          )}
        </div>
        
        {/* Book ride button */}
        <button 
          className="bg-habisin-dark text-white w-full py-4 rounded-xl font-medium text-lg"
          disabled={!pickup || !destination || loading || activeOrder !== null}
          onClick={bookRide}
        >
          {loading ? "Processing..." : activeOrder ? "Ride in progress" : "Book Ride"}
        </button>
      </div>
      
      {/* Order Status Dialog */}
      <Dialog open={showOrderStatus} onOpenChange={setShowOrderStatus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ride Status</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {activeOrder && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-habisin-dark"></div>
                  <p className="text-sm font-medium">{activeOrder.pickupAddress}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <p className="text-sm font-medium">{activeOrder.destinationAddress}</p>
                </div>
                
                {/* Display route info if available */}
                {activeOrder.routeInfo && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Distance: {activeOrder.routeInfo.distanceText}</span>
                      <span>Duration: {activeOrder.routeInfo.durationText}</span>
                    </div>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <p className="font-medium">Status: <span className="text-habisin-dark">{formatStatus(activeOrder.status)}</span></p>
                  {driverLocation && (
                    <p className="text-sm mt-2">
                      Driver is {Math.floor(Math.random() * 10) + 1} minutes away
                    </p>
                  )}
                </div>
                
                {/* Cancel Order Button */}
                <div className="mt-4 flex justify-end space-x-2">
                  <Button
                    variant="destructive"
                    onClick={cancelOrder}
                    disabled={loading}
                  >
                    {loading ? "Cancelling..." : "Cancel Order"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HabiRide;
