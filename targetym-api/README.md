# TARGETYM AI - Backend API

API Backend pour la plateforme RH TARGETYM AI.

## Stack Technique

- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Auth**: JWT (python-jose)
- **Déploiement**: Railway (dev) → AWS (prod)

## Structure du Projet

```
targetym-api/
├── app/
│   ├── api/           # Endpoints REST
│   │   ├── auth.py
│   │   ├── employees.py
│   │   ├── departments.py
│   │   └── deps.py    # Dependencies (auth, tenant)
│   ├── core/          # Config & utils
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── models/        # SQLAlchemy models
│   │   ├── tenant.py
│   │   ├── user.py
│   │   ├── employee.py
│   │   └── department.py
│   ├── schemas/       # Pydantic schemas
│   │   ├── auth.py
│   │   ├── employee.py
│   │   └── department.py
│   └── main.py        # App entry point
├── requirements.txt
├── Procfile
└── railway.json
```

## Déploiement Railway

1. Push sur GitHub
2. Connecter Railway au repo
3. Ajouter PostgreSQL
4. Configurer variables:
   - `DATABASE_URL` (auto Railway via ${{Postgres.DATABASE_URL}})
   - `SECRET_KEY`
   - `ENVIRONMENT=production`

## API Documentation

- Swagger UI: /docs
- ReDoc: /redoc

## Endpoints

### Auth
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Profil utilisateur

### Employees
- `GET /api/employees/` - Liste (pagination, filtres)
- `GET /api/employees/stats` - Statistiques
- `GET /api/employees/{id}` - Détail
- `POST /api/employees/` - Créer (Admin)
- `PUT /api/employees/{id}` - Modifier (Manager+)
- `DELETE /api/employees/{id}` - Supprimer (Admin)

### Departments
- `GET /api/departments/` - Liste
- `GET /api/departments/tree` - Organigramme
- `POST /api/departments/` - Créer (Admin)
- `PUT /api/departments/{id}` - Modifier (Admin)
