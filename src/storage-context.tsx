import React, { createContext } from 'react';
import { IStorage } from './storage';

export const StorageContext: React.Context<IStorage> = createContext(null as any);
