#!/bin/bash
# deploy-ecs.sh — Déploie la task-definition.json sur AWS ECS
# Usage:
#   1. Configurer les credentials : aws configure
#   2. ./deploy-ecs.sh
set -e

REGION="eu-west-1"
CLUSTER=""
SERVICE=""
TASK_FAMILY="targetym-api"

# Auto-détecter le cluster et le service si non définis
if [ -z "$CLUSTER" ]; then
  echo "🔍 Recherche du cluster ECS..."
  CLUSTER=$(aws ecs list-clusters --region $REGION --query 'clusterArns[0]' --output text | sed 's|.*/||')
  echo "   → Cluster : $CLUSTER"
fi

if [ -z "$SERVICE" ]; then
  echo "🔍 Recherche du service ECS..."
  SERVICE=$(aws ecs list-services --cluster $CLUSTER --region $REGION --query 'serviceArns[0]' --output text | sed 's|.*/||')
  echo "   → Service : $SERVICE"
fi

echo ""
echo "📦 Enregistrement de la nouvelle task definition..."
NEW_TASK=$(aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region $REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
echo "   ✅ Nouvelle revision : $NEW_TASK"

echo ""
echo "🚀 Déploiement du service $SERVICE (cluster $CLUSTER)..."
aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --task-definition $TASK_FAMILY \
  --force-new-deployment \
  --region $REGION \
  --query 'service.serviceName' \
  --output text

echo ""
echo "⏳ En attente de la stabilisation du service..."
aws ecs wait services-stable \
  --cluster $CLUSTER \
  --services $SERVICE \
  --region $REGION

echo ""
echo "✅ Déploiement terminé !"
