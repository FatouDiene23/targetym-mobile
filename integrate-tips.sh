#!/bin/bash
# Script temporaire pour intégrer PageTourTips sur toutes les pages


# Array des pages à intégrer: fichier|pageId|tipsName
pages=(
  "app/dashboard/my-space/objectives/page.tsx|objectives|objectivesTips"
  "app/dashboard/my-space/career/page.tsx|career|careerTips"
  "app/dashboard/my-space/team/page.tsx|team|teamTips"
  "app/dashboard/my-space/calendar/page.tsx|calendar|calendarTips"
  "app/dashboard/my-space/leaves/page.tsx|myLeaves|myLeavesTips"
  "app/dashboard/my-space/documents/page.tsx|documents|documentsTips"
  "app/dashboard/my-space/tasks/page.tsx|tasks|tasksTips"
  "app/dashboard/talents/page.tsx|talentsDashboard|talentsDashboardTips"
  "app/dashboard/talents/promotions/page.tsx|promotions|promotionsTips"
  "app/dashboard/talents/employees/page.tsx|talentsEmployees|talentsEmployeesTips"
  "app/dashboard/talents/team/page.tsx|talentsTeam|talentsTeamTips"
  "app/dashboard/talents/paths/page.tsx|paths|pathsTips"
  "app/dashboard/talents/my-career/page.tsx|myCareer|myCareerTips"
  "app/dashboard/talents/my-promotions/page.tsx|myPromotions|myPromotionsTips"
  "app/dashboard/performance1/page.tsx|performance1|performance1Tips"
)

echo "Pages à intégrer: ${#pages[@]}"

for page_info in "${pages[@]}"; do
  IFS='|' read -r file pageId tipsName <<< "$page_info"
  
  if [ -f "$file" ]; then
    echo "✓ Fichier trouvé: $file (pageId: $pageId)"
  else
    echo "✗ Fichier manquant: $file"
  fi
done

echo ""
echo "Note: Ce script liste les fichiers. L'intégration se fera via multi_replace_string_in_file"
