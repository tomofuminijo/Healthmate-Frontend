#!/usr/bin/env python3
"""
Environment File Generator for Healthmate Frontend

CloudFormationスタックから情報を取得して動的に環境ファイルを生成します。
"""

import os
import sys
import json
import boto3
import logging
from typing import Dict, Any
from pathlib import Path


class EnvironmentGenerator:
    """環境ファイル生成クラス"""
    
    def __init__(self, environment: str, region: str = 'us-west-2'):
        self.environment = environment
        self.region = region
        self.logger = self._setup_logger()
        
        # AWS クライアント初期化
        self.cf_client = boto3.client('cloudformation', region_name=region)
        self.bedrock_agentcore_client = boto3.client('bedrock-agentcore-control', region_name=region)
        
    def _setup_logger(self) -> logging.Logger:
        """ログ設定"""
        logger = logging.getLogger('env_generator')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def generate_env_file(self) -> bool:
        """環境ファイルを生成"""
        try:
            self.logger.info(f"🔧 Generating .env.{self.environment} file...")
            
            # CloudFormationから情報を取得
            env_vars = self._collect_environment_variables()
            
            # 環境ファイルを生成
            env_file_path = self._write_env_file(env_vars)
            
            self.logger.info(f"✅ Environment file generated: {env_file_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to generate environment file: {e}")
            return False
    
    def _collect_environment_variables(self) -> Dict[str, str]:
        """CloudFormationから環境変数を収集"""
        env_vars = {}
        
        # 基本設定
        env_vars['HEALTHMATE_ENV'] = self.environment
        env_vars['VITE_AWS_REGION'] = self.region
        env_vars['VITE_COGNITO_REGION'] = self.region
        
        # Cognito情報を取得
        cognito_vars = self._get_cognito_config()
        env_vars.update(cognito_vars)
        
        # CoachAI Agent ARNを取得（必須）
        coachai_arn = self._get_coachai_agent_arn()
        env_vars['VITE_COACHAI_AGENT_ARN'] = coachai_arn
        
        # API Base URL (開発用固定値)
        env_vars['VITE_API_BASE_URL'] = 'http://localhost:3000'
        
        # ログレベル
        env_vars['VITE_LOG_LEVEL'] = 'DEBUG' if self.environment == 'dev' else 'INFO'
        
        return env_vars
    
    def _get_cognito_config(self) -> Dict[str, str]:
        """Healthmate-CoreStackからCognito設定を取得"""
        stack_name = f"Healthmate-CoreStack-{self.environment}"
        
        try:
            self.logger.info(f"📡 Fetching Cognito config from {stack_name}...")
            
            response = self.cf_client.describe_stacks(StackName=stack_name)
            stack = response['Stacks'][0]
            outputs = {output['OutputKey']: output['OutputValue'] 
                      for output in stack.get('Outputs', [])}
            
            # 必須の出力値をチェック
            user_pool_id = outputs.get('UserPoolId')
            client_id = outputs.get('UserPoolClientId')
            
            if not user_pool_id:
                raise ValueError(f"UserPoolId not found in {stack_name} outputs")
            if not client_id:
                raise ValueError(f"UserPoolClientId not found in {stack_name} outputs")
            
            cognito_vars = {
                'VITE_COGNITO_USER_POOL_ID': user_pool_id,
                'VITE_COGNITO_CLIENT_ID': client_id,
            }
            
            self.logger.info(f"✅ Cognito config retrieved:")
            self.logger.info(f"   User Pool ID: {cognito_vars['VITE_COGNITO_USER_POOL_ID']}")
            self.logger.info(f"   Client ID: {cognito_vars['VITE_COGNITO_CLIENT_ID']}")
            
            return cognito_vars
            
        except Exception as e:
            self.logger.error(f"❌ Failed to get Cognito config from {stack_name}: {e}")
            raise RuntimeError(f"Cannot proceed without Cognito configuration from {stack_name}")
    
    def _get_coachai_agent_arn(self) -> str:
        """CoachAI Agent ARNをbedrock-agentcore-control APIから取得（必須）"""
        try:
            self.logger.info("📡 Fetching CoachAI Agent ARN from bedrock-agentcore-control...")
            
            # AgentCore Runtimesを一覧取得（正しいメソッド名を使用）
            response = self.bedrock_agentcore_client.list_agent_runtimes()
            
            # 環境に対応するRuntime名パターン
            env_suffix = "" if self.environment == "prod" else f"_{self.environment}"
            runtime_name_pattern = f"healthmate_coach_ai{env_suffix}"
            
            self.logger.info(f"🔍 Looking for runtime pattern: {runtime_name_pattern}")
            
            for runtime in response.get('agentRuntimes', []):
                runtime_name = runtime.get('agentRuntimeName', '')
                runtime_arn = runtime.get('agentRuntimeArn', '')
                
                self.logger.info(f"   Found runtime: {runtime_name}")
                
                if runtime_name_pattern in runtime_name:
                    self.logger.info(f"✅ CoachAI Agent ARN found: {runtime_arn}")
                    return runtime_arn
            
            # 見つからない場合はエラー
            self.logger.error(f"❌ CoachAI Agent ARN not found for pattern: {runtime_name_pattern}")
            self.logger.info("Available runtimes:")
            for runtime in response.get('agentRuntimes', []):
                self.logger.info(f"   - {runtime.get('agentRuntimeName', 'Unknown')}")
            
            raise RuntimeError(f"CoachAI Agent Runtime not found for environment: {self.environment}")
            
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise  # 既にRuntimeErrorの場合はそのまま再発生
            self.logger.error(f"❌ Failed to get CoachAI Agent ARN from bedrock-agentcore-control: {e}")
            raise RuntimeError(f"Cannot access bedrock-agentcore-control API: {e}")
    
    def _write_env_file(self, env_vars: Dict[str, str]) -> Path:
        """環境ファイルを書き込み"""
        project_root = Path(__file__).parent.parent
        env_file_path = project_root / f".env.{self.environment}"
        
        # 環境ファイルの内容を生成
        content = self._generate_env_content(env_vars)
        
        # ファイルに書き込み
        with open(env_file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        self.logger.info(f"📝 Environment file written to: {env_file_path}")
        return env_file_path
    
    def _generate_env_content(self, env_vars: Dict[str, str]) -> str:
        """環境ファイルの内容を生成"""
        env_title = {
            'dev': 'Development',
            'stage': 'Staging', 
            'prod': 'Production'
        }.get(self.environment, self.environment.title())
        
        content = f"""# {env_title} Environment Configuration
# Generated automatically by deploy.sh on {self._get_current_timestamp()}
# DO NOT EDIT MANUALLY - This file is regenerated on each deployment

# Environment
HEALTHMATE_ENV={env_vars.get('HEALTHMATE_ENV', '')}

# AWS Configuration
VITE_AWS_REGION={env_vars.get('VITE_AWS_REGION', '')}

# Cognito Configuration (from Healthmate-CoreStack-{self.environment})
VITE_COGNITO_USER_POOL_ID={env_vars.get('VITE_COGNITO_USER_POOL_ID', '')}
VITE_COGNITO_CLIENT_ID={env_vars.get('VITE_COGNITO_CLIENT_ID', '')}
VITE_COGNITO_REGION={env_vars.get('VITE_COGNITO_REGION', '')}

# API Endpoints ({env_title})
VITE_API_BASE_URL={env_vars.get('VITE_API_BASE_URL', '')}

# CoachAI Configuration ({env_title})
VITE_COACHAI_AGENT_ARN={env_vars.get('VITE_COACHAI_AGENT_ARN', '')}

# Logging Configuration
VITE_LOG_LEVEL={env_vars.get('VITE_LOG_LEVEL', '')}
"""
        return content
    
    def _get_current_timestamp(self) -> str:
        """現在のタイムスタンプを取得"""
        from datetime import datetime
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def main():
    """メイン関数"""
    if len(sys.argv) != 2:
        print("Usage: python generate_env.py <environment>")
        print("Environment: dev, stage, prod")
        sys.exit(1)
    
    environment = sys.argv[1]
    
    if environment not in ['dev', 'stage', 'prod']:
        print(f"❌ Invalid environment: {environment}")
        print("Valid environments: dev, stage, prod")
        sys.exit(1)
    
    # AWS認証情報の確認
    try:
        sts_client = boto3.client('sts')
        sts_client.get_caller_identity()
    except Exception as e:
        print(f"❌ AWS credentials not configured: {e}")
        sys.exit(1)
    
    # 環境ファイル生成
    generator = EnvironmentGenerator(environment)
    success = generator.generate_env_file()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()