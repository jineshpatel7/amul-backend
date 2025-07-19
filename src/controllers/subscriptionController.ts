import { Request, Response } from 'express';
import { Product } from '@/models/Product';
import { Subscription } from '@/models/Subscription';
import { SubscribeRequest, UnsubscribeRequest, ApiResponse, SubscriptionWithProduct } from '@/types';

export const subscribeToProduct = async (req: Request<{}, {}, SubscribeRequest>, res: Response): Promise<void> => {
  try {
    const { email, productId, telegramUsername } = req.body;
    
    if (!email || !productId) {
      const response: ApiResponse = {
        success: false,
        error: 'Email and productId are required'
      };
      res.status(400).json(response);
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid email format'
      };
      res.status(400).json(response);
      return;
    }

    // Validate telegram username format if provided
    if (telegramUsername) {
      const telegramRegex = /^[a-zA-Z0-9_]{5,32}$/;
      const cleanUsername = telegramUsername.replace('@', ''); // Remove @ if present
      if (!telegramRegex.test(cleanUsername)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid Telegram username format (5-32 characters, letters, numbers, underscores only)'
        };
        res.status(400).json(response);
        return;
      }
    }
    
    // Check if product exists
    const product = await Product.findOne({ productId });
    if (!product) {
      const response: ApiResponse = {
        success: false,
        error: 'Product not found'
      };
      res.status(404).json(response);
      return;
    }
    
    // Check if subscription already exists
    const existingSubscription = await Subscription.findOne({ email, productId });
    if (existingSubscription) {
      if (existingSubscription.isActive) {
        // Update telegram username if provided
        if (telegramUsername) {
          existingSubscription.telegramUsername = telegramUsername.replace('@', '');
          await existingSubscription.save();
        }
        
        const response: ApiResponse = {
          success: false,
          error: 'Already subscribed to this product'
        };
        res.status(400).json(response);
        return;
      } else {
        // Reactivate subscription and update telegram username
        existingSubscription.isActive = true;
        if (telegramUsername) {
          existingSubscription.telegramUsername = telegramUsername.replace('@', '');
        }
        await existingSubscription.save();
        
        const response: ApiResponse = {
          success: true,
          message: 'Subscription reactivated successfully'
        };
        res.json(response);
        return;
      }
    }
    
    // Create new subscription
    const subscriptionData: any = { 
      email, 
      productId 
    };
    
    if (telegramUsername) {
      subscriptionData.telegramUsername = telegramUsername.replace('@', '');
    }
    
    const subscription = new Subscription(subscriptionData);
    await subscription.save();
    
    const response: ApiResponse = {
      success: true,
      message: 'Successfully subscribed to product notifications'
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
};

export const unsubscribeFromProduct = async (req: Request<{}, {}, UnsubscribeRequest>, res: Response): Promise<void> => {
  try {
    const { email, productId } = req.body;
    
    const subscription = await Subscription.findOne({ email, productId });
    if (!subscription) {
      const response: ApiResponse = {
        success: false,
        error: 'Subscription not found'
      };
      res.status(404).json(response);
      return;
    }
    
    subscription.isActive = false;
    await subscription.save();
    
    const response: ApiResponse = {
      success: true,
      message: 'Successfully unsubscribed'
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
};

export const getUserSubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = req.params.email;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid email format'
      };
      res.status(400).json(response);
      return;
    }
    
    const subscriptions = await Subscription.find({ 
      email, 
      isActive: true 
    });
    
    const subscriptionsWithProducts: SubscriptionWithProduct[] = [];
    for (const sub of subscriptions) {
      const product = await Product.findOne({ productId: sub.productId });
      if (product) {
        subscriptionsWithProducts.push({
          ...sub.toObject(),
          product: product
        } as unknown as SubscriptionWithProduct);
      }
    }
    
    const response: ApiResponse = {
      success: true,
      data: subscriptionsWithProducts
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
};