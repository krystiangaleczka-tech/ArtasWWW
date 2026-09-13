# Weryfikacja

13 września 2026.

- TypeScript: `tsc --noEmit` — bez błędów.
- Testy logiki: `node scripts/verify-artas.mjs` — 17 unikalnych kart produktów i ich pliki zdjęć, zgodność wariantów profili, sumy modułów bram, ciągłość toru rolety i bramy, skończone transformacje wszystkich ośmiu modeli, synchronizacja ruchu listwy dolnej, zgodność części gry z modelem, kolizje przewodów w całym odcinku ruchu oraz poprawność narożników zdjęcia.
- Budowa produkcyjna: skrypt Sites / Vinext — zakończona poprawnie. Three.js ładowany dynamicznie; trzy gry mają osobne chunki, a ostrzeżenie o wielkości paczki silnika 3D jest spodziewane.
- WebMCP: implementacja wykrywa obsługę przeglądarki. Test rejestracji i wywołań w obsługiwanym kontekście przeglądarkowym nie był dostępny w autoryzowanym zakresie tej sesji.
- Testy interfejsu w rzeczywistej przeglądarce nie były wykonywane. Ten profil środowiska udostępnia podgląd do testów dopiero na wyraźne zlecenie użytkownika. To ograniczenie sprawdzenia wyglądu i interakcji, nie potwierdzenie ich pełnej zgodności we wszystkich przeglądarkach.

Podstawowy scenariusz przeglądowy: scroll otwarcia / pominięcie / ograniczony ruch; wszystkie podstrony; kolory i profile; rozstrzelenie / złożenie / półprzekrój / zoom; zdjęcie JPG, narożniki, porównanie, eksport; Gate Rush na kilku poziomach z pilotem i resetem; poprawne i błędne constrainty Montera; sześć naciśnięć OPEN, konfiguracja DS1 i symulacja zdarzeń w Trybie nauki; telefon i tablet.
