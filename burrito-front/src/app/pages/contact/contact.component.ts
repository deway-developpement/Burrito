import { Component, inject } from '@angular/core';
// import { Location } from '@angular/common'; // Plus besoin de Location
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent {
  
  // Dependencies
  // private location = inject(Location); // Supprimé
  private router = inject(Router);
  private toast = inject(ToastService);

  onSubmit(event: Event): void {
    event.preventDefault(); // Empêche le rechargement natif de la page
    
    // Simulation de l'envoi...

    // 1. Show Success Toast
    this.toast.show('Message sent successfully! We will get back to you soon.', 'success');

    // 2. Redirect to Home with a small delay
    // Le délai permet à l'utilisateur de voir le message avant que la page ne change
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 1500); 
  }

  goBack(): void {
    // Go to home instead of history back
    this.router.navigate(['/']);
  }
}