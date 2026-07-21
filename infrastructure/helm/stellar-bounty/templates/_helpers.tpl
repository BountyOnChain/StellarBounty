{{/*
Expand the name of the chart.
Usage: include "stellar-bounty.name" .
*/}}
{{- define "stellar-bounty.name" -}}
{{- if .Values.nameOverride -}}
{{- .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
Usage: include "stellar-bounty.fullname" .
*/}}
{{- define "stellar-bounty.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "stellar-bounty.name" . -}}
{{- if eq $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
Usage: include "stellar-bounty.chart" .
*/}}
{{- define "stellar-bounty.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Selector labels — used as `matchLabels` for Deployments / Services / PDBs.
Takes root context directly (NOT a dict).
Usage: include "stellar-bounty.selectorLabels" .
*/}}
{{- define "stellar-bounty.selectorLabels" -}}
app.kubernetes.io/name: {{ include "stellar-bounty.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Common labels — applied to every resource managed by the chart.
Takes root context directly (NOT a dict).
Usage: include "stellar-bounty.labels" .
*/}}
{{- define "stellar-bounty.labels" -}}
helm.sh/chart: {{ include "stellar-bounty.chart" . }}
{{ include "stellar-bounty.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: stellar-bounty
{{- end -}}

{{/*
Component labels — for resources associated with a named component
(backend / frontend / postgres / promtail). Takes a dict so the
component slug can be passed alongside the chart root.
Usage: include "stellar-bounty.componentLabels" (dict "ctx" . "component" "backend")
*/}}
{{- define "stellar-bounty.componentLabels" -}}
helm.sh/chart: {{ include "stellar-bounty.chart" .ctx }}
{{ include "stellar-bounty.selectorLabels" .ctx }}
app.kubernetes.io/version: {{ .ctx.Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .ctx.Release.Service }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/part-of: stellar-bounty
{{- end -}}

{{/*
Component selector labels — uses the component slug directly so
matchLabels keeps app.kubernetes.io/name distinct across components.
Usage: include "stellar-bounty.componentSelectorLabels" (dict "ctx" . "component" "backend")
*/}}
{{- define "stellar-bounty.componentSelectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
{{- end -}}

{{/*
Secret name resolver — the deployment only references a Secret by name;
the Secret itself lives out-of-band (sealed-secrets / external-secrets).
Usage: include "stellar-bounty.secretName" (dict "secret" .Values.secrets.backend)
*/}}
{{- define "stellar-bounty.secretName" -}}
{{- .secret.existingSecret -}}
{{- end -}}
