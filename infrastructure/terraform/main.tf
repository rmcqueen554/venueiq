terraform {
  required_version = ">= 1.8"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
  backend "s3" {
    bucket         = "venueiq-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "venueiq-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "VenueIQ"
      ManagedBy   = "Terraform"
      Owner       = "ACG"
      Environment = var.environment
    }
  }
}

variable "aws_region"   { default = "us-east-1" }
variable "environment"  { default = "production" }
variable "app_name"     { default = "venueiq" }
