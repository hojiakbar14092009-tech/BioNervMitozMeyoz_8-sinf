import type { Book, BookId } from '../types';

export const books: Record<BookId, Book> = {
  grade8: {
    id: 'grade8',
    title: '8-sinf Biologiya',
    grade: '8-sinf',
    subtitle: 'Nerv sistemasi va oliy nerv faoliyati',
    scope: '39–51-§',
    route: '/8-sinf',
    source: 'Biologiya (Odam va uning salomatligi). 8-sinf darsligi. O‘qituvchi, 2019',
    numbering: ['39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51'],
    accent: '#5b6bb5',
  },
  grade10: {
    id: 'grade10',
    title: '10-sinf Biologiya',
    grade: '10-sinf',
    subtitle: 'Hujayra metabolizmi, irsiy axborot, mitoz va meyoz',
    scope: '2.8–2.15',
    route: '/10-sinf',
    source: 'Biologiya 10. Darslik, 2022',
    numbering: ['2.8', '2.9', '2.10', '2.11', '2.12', '2.13', '2.14', '2.15'],
    accent: '#2f8a86',
  },
};

export const bookList: Book[] = [books.grade8, books.grade10];
