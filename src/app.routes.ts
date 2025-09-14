import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: 'creator',
    title: 'Creator | Focus-IN',
    loadComponent: () => import('./creator/creator.component').then(m => m.CreatorComponent),
  },
  {
    path: 'dashboard',
    title: 'Dashboard | Focus-IN',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  { path: '', redirectTo: 'creator', pathMatch: 'full' },
  { path: '**', redirectTo: 'creator' }
];