"""
Script de seed pour créer des données de test
Usage: python seed.py
"""
from datetime import date, datetime
from decimal import Decimal
import sys
import os

# Ajouter le répertoire parent au path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models import (
    Tenant, User, Department, Employee, 
    LeaveType, LeaveBalance, UserRole
)


def seed_database():
    """Créer les données de test"""
    
    # Créer les tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Vérifier si déjà seedé
        existing_tenant = db.query(Tenant).filter(Tenant.id == "demo-company").first()
        if existing_tenant:
            print("Base de données déjà initialisée!")
            return
        
        print("Création des données de test...")
        
        # 1. Créer un Tenant (entreprise cliente)
        tenant = Tenant(
            id="demo-company",
            name="Entreprise Demo SARL",
            subdomain="demo",
            industry="Technologie",
            country="Sénégal",
            address="123 Avenue de la République, Dakar",
            phone="+221 33 123 45 67",
            email="contact@demo-company.sn",
            timezone="Africa/Dakar",
            language="fr",
            currency="XOF",
            plan="professional",
            max_employees=100,
            is_active=True,
            is_trial=False
        )
        db.add(tenant)
        db.flush()
        print("✅ Tenant créé")
        
        # 2. Créer les départements
        departments = [
            Department(tenant_id="demo-company", name="Direction Générale", code="DG"),
            Department(tenant_id="demo-company", name="Ressources Humaines", code="RH"),
            Department(tenant_id="demo-company", name="Technologie", code="TECH"),
            Department(tenant_id="demo-company", name="Commercial", code="COM"),
            Department(tenant_id="demo-company", name="Finance", code="FIN"),
            Department(tenant_id="demo-company", name="Marketing", code="MKT"),
        ]
        for dept in departments:
            db.add(dept)
        db.flush()
        print("✅ Départements créés")
        
        # Récupérer les IDs des départements
        dept_dg = db.query(Department).filter(Department.code == "DG").first()
        dept_rh = db.query(Department).filter(Department.code == "RH").first()
        dept_tech = db.query(Department).filter(Department.code == "TECH").first()
        dept_com = db.query(Department).filter(Department.code == "COM").first()
        
        # 3. Créer les employés
        employees_data = [
            # DG
            {
                "employee_number": "EMP001",
                "first_name": "Amadou",
                "last_name": "Diallo",
                "email": "amadou.diallo@demo-company.sn",
                "phone": "+221 77 123 45 01",
                "position": "Directeur Général",
                "department_id": dept_dg.id,
                "contract_type": "CDI",
                "hire_date": date(2018, 1, 15),
                "salary": Decimal("3500000"),
                "is_manager": True,
                "is_top_manager": True,
                "gender": "M",
                "date_of_birth": date(1975, 5, 12),
            },
            # RH
            {
                "employee_number": "EMP002",
                "first_name": "Fatou",
                "last_name": "Ndiaye",
                "email": "fatou.ndiaye@demo-company.sn",
                "phone": "+221 77 123 45 02",
                "position": "Directrice RH",
                "department_id": dept_rh.id,
                "contract_type": "CDI",
                "hire_date": date(2019, 3, 1),
                "salary": Decimal("2200000"),
                "is_manager": True,
                "is_top_manager": True,
                "gender": "F",
                "date_of_birth": date(1982, 8, 23),
            },
            # Tech Manager
            {
                "employee_number": "EMP003",
                "first_name": "Moussa",
                "last_name": "Sow",
                "email": "moussa.sow@demo-company.sn",
                "phone": "+221 77 123 45 03",
                "position": "Directeur Technique",
                "department_id": dept_tech.id,
                "contract_type": "CDI",
                "hire_date": date(2019, 6, 15),
                "salary": Decimal("2500000"),
                "is_manager": True,
                "is_top_manager": True,
                "gender": "M",
                "date_of_birth": date(1985, 11, 3),
            },
            # Développeur Senior
            {
                "employee_number": "EMP004",
                "first_name": "Aissatou",
                "last_name": "Ba",
                "email": "aissatou.ba@demo-company.sn",
                "phone": "+221 77 123 45 04",
                "position": "Développeuse Senior",
                "department_id": dept_tech.id,
                "contract_type": "CDI",
                "hire_date": date(2020, 2, 1),
                "salary": Decimal("1500000"),
                "is_manager": False,
                "gender": "F",
                "date_of_birth": date(1992, 4, 17),
            },
            # Commercial
            {
                "employee_number": "EMP005",
                "first_name": "Ibrahima",
                "last_name": "Fall",
                "email": "ibrahima.fall@demo-company.sn",
                "phone": "+221 77 123 45 05",
                "position": "Responsable Commercial",
                "department_id": dept_com.id,
                "contract_type": "CDI",
                "hire_date": date(2021, 1, 10),
                "salary": Decimal("1800000"),
                "is_manager": True,
                "gender": "M",
                "date_of_birth": date(1988, 7, 29),
            },
        ]
        
        created_employees = []
        for emp_data in employees_data:
            emp = Employee(tenant_id="demo-company", **emp_data)
            db.add(emp)
            db.flush()
            created_employees.append(emp)
        print("✅ Employés créés")
        
        # Définir les managers
        created_employees[3].manager_id = created_employees[2].id  # Aissatou -> Moussa
        created_employees[2].manager_id = created_employees[0].id  # Moussa -> Amadou
        created_employees[1].manager_id = created_employees[0].id  # Fatou -> Amadou
        created_employees[4].manager_id = created_employees[0].id  # Ibrahima -> Amadou
        db.flush()
        
        # 4. Créer les utilisateurs
        users_data = [
            {"email": "amadou.diallo@demo-company.sn", "first_name": "Amadou", "last_name": "Diallo", "role": UserRole.DG.value, "employee": created_employees[0]},
            {"email": "fatou.ndiaye@demo-company.sn", "first_name": "Fatou", "last_name": "Ndiaye", "role": UserRole.RH.value, "employee": created_employees[1]},
            {"email": "moussa.sow@demo-company.sn", "first_name": "Moussa", "last_name": "Sow", "role": UserRole.MANAGER.value, "employee": created_employees[2]},
            {"email": "aissatou.ba@demo-company.sn", "first_name": "Aissatou", "last_name": "Ba", "role": UserRole.COLLABORATEUR.value, "employee": created_employees[3]},
            {"email": "ibrahima.fall@demo-company.sn", "first_name": "Ibrahima", "last_name": "Fall", "role": UserRole.MANAGER.value, "employee": created_employees[4]},
        ]
        
        for user_data in users_data:
            user = User(
                tenant_id="demo-company",
                email=user_data["email"],
                first_name=user_data["first_name"],
                last_name=user_data["last_name"],
                hashed_password=hash_password("password123"),  # Mot de passe par défaut
                role=user_data["role"],
                employee_id=user_data["employee"].id,
                is_active=True,
                is_verified=True
            )
            db.add(user)
        db.flush()
        print("✅ Utilisateurs créés")
        
        # 5. Créer les types de congés
        leave_types = [
            LeaveType(tenant_id="demo-company", name="Congés annuels", code="CA", default_days=24, is_paid=True, color="#10B981"),
            LeaveType(tenant_id="demo-company", name="Congés maladie", code="MAL", default_days=15, is_paid=True, requires_justification=True, color="#EF4444"),
            LeaveType(tenant_id="demo-company", name="Congés maternité", code="MAT", default_days=98, is_paid=True, color="#EC4899"),
            LeaveType(tenant_id="demo-company", name="Congés paternité", code="PAT", default_days=10, is_paid=True, color="#3B82F6"),
            LeaveType(tenant_id="demo-company", name="Congés sans solde", code="CSS", default_days=0, is_paid=False, color="#6B7280"),
            LeaveType(tenant_id="demo-company", name="Événement familial", code="EVT", default_days=5, is_paid=True, color="#8B5CF6"),
        ]
        
        for lt in leave_types:
            db.add(lt)
        db.flush()
        print("✅ Types de congés créés")
        
        # 6. Créer les soldes de congés
        lt_ca = db.query(LeaveType).filter(LeaveType.code == "CA").first()
        lt_mal = db.query(LeaveType).filter(LeaveType.code == "MAL").first()
        
        current_year = date.today().year
        for emp in created_employees:
            # Congés annuels
            balance_ca = LeaveBalance(
                tenant_id="demo-company",
                employee_id=emp.id,
                leave_type_id=lt_ca.id,
                year=current_year,
                allocated=Decimal("24"),
                taken=Decimal("5"),
                pending=Decimal("0"),
                carried_over=Decimal("3")
            )
            db.add(balance_ca)
            
            # Congés maladie
            balance_mal = LeaveBalance(
                tenant_id="demo-company",
                employee_id=emp.id,
                leave_type_id=lt_mal.id,
                year=current_year,
                allocated=Decimal("15"),
                taken=Decimal("2"),
                pending=Decimal("0"),
                carried_over=Decimal("0")
            )
            db.add(balance_mal)
        
        print("✅ Soldes de congés créés")
        
        db.commit()
        print("\n🎉 Base de données initialisée avec succès!")
        print("\n📋 Comptes de test créés:")
        print("-" * 50)
        print("| Email                              | Mot de passe | Rôle        |")
        print("-" * 50)
        print("| amadou.diallo@demo-company.sn     | password123  | DG          |")
        print("| fatou.ndiaye@demo-company.sn      | password123  | RH          |")
        print("| moussa.sow@demo-company.sn        | password123  | Manager     |")
        print("| aissatou.ba@demo-company.sn       | password123  | Collaborateur|")
        print("| ibrahima.fall@demo-company.sn     | password123  | Manager     |")
        print("-" * 50)
        print("\n🌐 Subdomain: demo")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
